import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as synthetics from 'aws-cdk-lib/aws-synthetics';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as subscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import * as cw_actions from 'aws-cdk-lib/aws-cloudwatch-actions';
import { MonitoringFacade, IAlarmActionStrategy, AlarmActionStrategyProps } from 'cdk-monitoring-constructs';

export interface MonitoringStackProps extends cdk.StackProps {
  /**
   * Domain name to monitor
   * @default 'krishakshayak.duckdns.org'
   */
  readonly domainName?: string;

  /**
   * Email to receive downtime and performance alerts
   * @default 'lavishshakya066@gmail.com'
   */
  readonly alertEmail?: string;
}

export class MonitoringStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: MonitoringStackProps) {
    super(scope, id, props);

    const domain = props?.domainName || 'krishakshayak.duckdns.org';
    const email = props?.alertEmail || 'lavishshakya066@gmail.com';

    // ─────────────────────────────────────────────
    // 1. ALERTING: SNS Topic & Email Subscription
    // ─────────────────────────────────────────────
    const alertTopic = new sns.Topic(this, 'MonitoringAlertTopic', {
      topicName: 'krishak-shayak-operational-alerts',
      displayName: 'Krishak Shayak Operational Alerts',
    });

    alertTopic.addSubscription(new subscriptions.EmailSubscription(email));

    const snsActionStrategy: IAlarmActionStrategy = {
      addAlarmActions: (props: AlarmActionStrategyProps) => {
        props.alarm.addAlarmAction(new cw_actions.SnsAction(alertTopic));
      },
    };

    // ─────────────────────────────────────────────
    // 2. SYNTHETICS: Artifacts S3 Bucket
    // ─────────────────────────────────────────────
    const canaryArtifactsBucket = new s3.Bucket(this, 'CanaryArtifactsBucket', {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
    });

    // ─────────────────────────────────────────────
    // 3. SYNTHETICS CANARY: Frontend Web Uptime
    // ─────────────────────────────────────────────
    const frontendCanary = new synthetics.Canary(this, 'FrontendCanary', {
      canaryName: 'ks-frontend-check',
      schedule: synthetics.Schedule.rate(cdk.Duration.minutes(5)),
      artifactsBucketLocation: { bucket: canaryArtifactsBucket },
      runtime: synthetics.Runtime.SYNTHETICS_NODEJS_PUPPETEER_8_0,
      test: synthetics.Test.custom({
        code: synthetics.Code.fromInline(`
const synthetics = require('Synthetics');
const log = require('SyntheticsLogger');

const executeTest = async function () {
  const page = await synthetics.getPage();
  log.info('Navigating to https://${domain}');
  const response = await page.goto('https://${domain}', {
    waitUntil: ['domcontentloaded'],
    timeout: 30000,
  });
  if (!response) {
    throw new Error('Failed to load frontend page');
  }
  const status = response.status();
  log.info('Response status: ' + status);
  if (status >= 400) {
    throw new Error('Frontend returned error HTTP status: ' + status);
  }
};

exports.handler = async () => {
  return await executeTest();
};
`),
        handler: 'index.handler',
      }),
    });

    // ─────────────────────────────────────────────
    // 4. SYNTHETICS CANARY: Backend API Health (/api/schemes)
    // ─────────────────────────────────────────────
    const backendApiCanary = new synthetics.Canary(this, 'BackendApiCanary', {
      canaryName: 'ks-api-check',
      schedule: synthetics.Schedule.rate(cdk.Duration.minutes(5)),
      artifactsBucketLocation: { bucket: canaryArtifactsBucket },
      runtime: synthetics.Runtime.SYNTHETICS_NODEJS_PUPPETEER_8_0,
      test: synthetics.Test.custom({
        code: synthetics.Code.fromInline(`
const synthetics = require('Synthetics');
const log = require('SyntheticsLogger');

const executeTest = async function () {
  const requestOptions = {
    hostname: '${domain}',
    method: 'GET',
    path: '/api/schemes',
    port: '443',
    protocol: 'https:',
  };
  log.info('Requesting https://${domain}/api/schemes');
  await synthetics.executeHttpStep('Get Schemes Endpoint', requestOptions, (res) => {
    log.info('API returned status: ' + res.statusCode);
    if (res.statusCode >= 400) {
      throw new Error('API returned HTTP error status: ' + res.statusCode);
    }
  });
};

exports.handler = async () => {
  return await executeTest();
};
`),
        handler: 'index.handler',
      }),
    });

    // ─────────────────────────────────────────────
    // 5. MONITORING FACADE (cdk-monitoring-constructs)
    // ─────────────────────────────────────────────
    const monitoring = new MonitoringFacade(this, 'MonitoringFacade', {
      alarmFactoryDefaults: {
        alarmNamePrefix: 'KrishakShayak-',
        actionsEnabled: true,
        action: snsActionStrategy,
      },
    });

    // Monitor Frontend Canary Uptime & Latency
    monitoring.monitorSyntheticsCanary({
      canary: frontendCanary,
      humanReadableName: 'Frontend Web Health',
      alarmFriendlyName: 'FrontendDown',
      add4xxErrorCountAlarm: {
        critical: { maxErrorCount: 1 },
      },
      add5xxFaultCountAlarm: {
        critical: { maxErrorCount: 1 },
      },
      addAverageLatencyAlarm: {
        warning: { maxLatency: cdk.Duration.seconds(10) },
      },
    });

    // Monitor Backend API Canary Uptime & Latency
    monitoring.monitorSyntheticsCanary({
      canary: backendApiCanary,
      humanReadableName: 'Backend Schemes API Health',
      alarmFriendlyName: 'BackendApiDown',
      add4xxErrorCountAlarm: {
        critical: { maxErrorCount: 1 },
      },
      add5xxFaultCountAlarm: {
        critical: { maxErrorCount: 1 },
      },
      addAverageLatencyAlarm: {
        warning: { maxLatency: cdk.Duration.seconds(5) },
      },
    });

    // ─────────────────────────────────────────────
    // 6. OUTPUTS
    // ─────────────────────────────────────────────
    new cdk.CfnOutput(this, 'DashboardUrl', {
      description: 'CloudWatch Executive Dashboard URL',
      value: `https://${this.region}.console.aws.amazon.com/cloudwatch/home?region=${this.region}#dashboards:name=KrishakShayak-Executive-Dashboard`,
    });

    new cdk.CfnOutput(this, 'AlertTopicArn', {
      description: 'SNS Alert Topic ARN',
      value: alertTopic.topicArn,
    });
  }
}
