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
   * @default 'lavishshakyaprep@gmail.com'
   */
  readonly alertEmail?: string;
}

export class MonitoringStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: MonitoringStackProps) {
    super(scope, id, props);

    const domain = props?.domainName || 'krishakshayak.duckdns.org';
    const email = props?.alertEmail || 'lavishshakyaprep@gmail.com';

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

    // AWS Free Tier includes 100 canary runs/month across your entire AWS account.
    // 6 Canaries * 15 runs/month (once every 2 days) = 90 runs/month <= 100 (100% Free Tier).
    // Note: AWS Synthetics rate() only allows 1-60 minutes. Schedules > 1 hour must use cron expressions.
    const freeTierSchedule = synthetics.Schedule.expression('cron(0 0 */2 * ? *)');

    // ─────────────────────────────────────────────
    // 3. SYNTHETICS CANARY: Frontend Web Uptime
    // ─────────────────────────────────────────────
    const frontendCanary = new synthetics.Canary(this, 'FrontendCanary', {
      canaryName: 'ks-frontend-check',
      schedule: freeTierSchedule,
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
    // 4. SYNTHETICS CANARY: Schemes API (Google Sheets)
    // ─────────────────────────────────────────────
    const schemesCanary = new synthetics.Canary(this, 'SchemesApiCanary', {
      canaryName: 'ks-schemes-check',
      schedule: freeTierSchedule,
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
      throw new Error('Schemes API returned HTTP error: ' + res.statusCode);
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
    // 5. SYNTHETICS CANARY: Weather API (OpenWeatherMap)
    // ─────────────────────────────────────────────
    const weatherCanary = new synthetics.Canary(this, 'WeatherApiCanary', {
      canaryName: 'ks-weather-check',
      schedule: freeTierSchedule,
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
    path: '/api/weather?location=Delhi',
    port: '443',
    protocol: 'https:',
  };
  log.info('Requesting https://${domain}/api/weather?location=Delhi');
  await synthetics.executeHttpStep('Get Weather Endpoint', requestOptions, (res) => {
    log.info('Weather API returned status: ' + res.statusCode);
    if (res.statusCode >= 400) {
      throw new Error('Weather API returned HTTP error: ' + res.statusCode);
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
    // 6. SYNTHETICS CANARY: Market Prices API (Data.gov.in)
    // ─────────────────────────────────────────────
    const marketPricesCanary = new synthetics.Canary(this, 'MarketPricesApiCanary', {
      canaryName: 'ks-market-check',
      schedule: freeTierSchedule,
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
    path: '/api/market-prices?state=Delhi',
    port: '443',
    protocol: 'https:',
  };
  log.info('Requesting https://${domain}/api/market-prices?state=Delhi');
  await synthetics.executeHttpStep('Get Market Prices Endpoint', requestOptions, (res) => {
    log.info('Market Prices API returned status: ' + res.statusCode);
    if (res.statusCode >= 400) {
      throw new Error('Market Prices API returned HTTP error: ' + res.statusCode);
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
    // 7. SYNTHETICS CANARY: Products API (MongoDB check)
    // ─────────────────────────────────────────────
    const productsCanary = new synthetics.Canary(this, 'ProductsApiCanary', {
      canaryName: 'ks-products-check',
      schedule: freeTierSchedule,
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
    path: '/api/products',
    port: '443',
    protocol: 'https:',
  };
  log.info('Requesting https://${domain}/api/products');
  await synthetics.executeHttpStep('Get Products Endpoint', requestOptions, (res) => {
    log.info('Products API returned status: ' + res.statusCode);
    if (res.statusCode >= 400) {
      throw new Error('Products API returned HTTP error: ' + res.statusCode);
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
    // 8. SYNTHETICS CANARY: Seller Shops API (MongoDB check)
    // ─────────────────────────────────────────────
    const shopsCanary = new synthetics.Canary(this, 'ShopsApiCanary', {
      canaryName: 'ks-shops-check',
      schedule: freeTierSchedule,
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
    path: '/api/seller/shops',
    port: '443',
    protocol: 'https:',
  };
  log.info('Requesting https://${domain}/api/seller/shops');
  await synthetics.executeHttpStep('Get Seller Shops Endpoint', requestOptions, (res) => {
    log.info('Shops API returned status: ' + res.statusCode);
    if (res.statusCode >= 400) {
      throw new Error('Shops API returned HTTP error: ' + res.statusCode);
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
    // 9. MONITORING FACADE (cdk-monitoring-constructs)
    // ─────────────────────────────────────────────
    const monitoring = new MonitoringFacade(this, 'MonitoringFacade', {
      alarmFactoryDefaults: {
        alarmNamePrefix: 'KrishakShayak-',
        actionsEnabled: true,
        action: snsActionStrategy,
      },
    });

    // ── Frontend ──
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

    // ── Schemes API (Google Sheets) ──
    monitoring.monitorSyntheticsCanary({
      canary: schemesCanary,
      humanReadableName: 'Schemes API (Google Sheets)',
      alarmFriendlyName: 'SchemesApiDown',
      add4xxErrorCountAlarm: {
        critical: { maxErrorCount: 1 },
      },
      add5xxFaultCountAlarm: {
        critical: { maxErrorCount: 1 },
      },
      addAverageLatencyAlarm: {
        warning: { maxLatency: cdk.Duration.seconds(8) },
      },
    });

    // ── Weather API (OpenWeatherMap) ──
    monitoring.monitorSyntheticsCanary({
      canary: weatherCanary,
      humanReadableName: 'Weather API (OpenWeatherMap)',
      alarmFriendlyName: 'WeatherApiDown',
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

    // ── Market Prices API (Data.gov.in) ──
    monitoring.monitorSyntheticsCanary({
      canary: marketPricesCanary,
      humanReadableName: 'Market Prices API (Data.gov.in)',
      alarmFriendlyName: 'MarketPricesApiDown',
      add4xxErrorCountAlarm: {
        critical: { maxErrorCount: 1 },
      },
      add5xxFaultCountAlarm: {
        critical: { maxErrorCount: 1 },
      },
      addAverageLatencyAlarm: {
        warning: { maxLatency: cdk.Duration.seconds(8) },
      },
    });

    // ── Products API (MongoDB health check) ──
    monitoring.monitorSyntheticsCanary({
      canary: productsCanary,
      humanReadableName: 'Products API (MongoDB)',
      alarmFriendlyName: 'ProductsApiDown',
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

    // ── Seller Shops API (MongoDB health check) ──
    monitoring.monitorSyntheticsCanary({
      canary: shopsCanary,
      humanReadableName: 'Seller Shops API (MongoDB)',
      alarmFriendlyName: 'ShopsApiDown',
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
    // 10. OUTPUTS
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
