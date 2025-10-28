const Order = require("../models/Order");

// Create a new order
exports.createOrder = async (req, res) => {
  try {
    const { items, shippingAddress, paymentMethod, subtotal, shipping, total } =
      req.body;

    // Log the incoming data for debugging
    console.log("Creating order with data:", {
      itemsCount: items?.length,
      hasShippingAddress: !!shippingAddress,
      paymentMethod,
      subtotal,
      shipping,
      total,
    });

    // Validate required fields
    if (!items || items.length === 0) {
      return res
        .status(400)
        .json({ message: "Order must contain at least one item" });
    }

    if (
      !shippingAddress ||
      !shippingAddress.fullName ||
      !shippingAddress.address
    ) {
      return res.status(400).json({ message: "Shipping address is required" });
    }

    // Validate and sanitize items
    const sanitizedItems = items.map((item, index) => {
      const productId = item.productId || item.id || item._id;

      if (!productId) {
        console.error(`Item at index ${index} is missing productId:`, item);
        throw new Error(`Item at index ${index} is missing productId`);
      }

      return {
        productId: String(productId),
        name: item.name || "Unknown Product",
        price: parseFloat(item.price) || 0,
        quantity: parseInt(item.quantity) || 1,
        image: item.image || item.imageUrl || "",
        seller: item.seller || "Unknown Seller",
        status: "pending", // Initialize each item with pending status
      };
    });

    // Validate all items have required fields
    const invalidItems = sanitizedItems.filter(
      (item) => !item.productId || !item.name
    );
    if (invalidItems.length > 0) {
      console.error("Invalid items found:", invalidItems);
      return res.status(400).json({
        message: "Some items are missing required fields",
        invalidItems,
      });
    }

    console.log("Sanitized items:", sanitizedItems);

    // Create the order
    const order = new Order({
      buyer: req.user.id,
      items: sanitizedItems,
      shippingAddress,
      paymentMethod: paymentMethod || "cash",
      subtotal: parseFloat(subtotal),
      shipping: parseFloat(shipping) || 0,
      total: parseFloat(total),
      status: "pending",
    });

    await order.save();

    console.log("Order created successfully:", order._id);

    res.status(201).json({
      success: true,
      message: "Order placed successfully",
      orderId: order._id,
      order,
    });
  } catch (error) {
    console.error("Error creating order:", error);
    res
      .status(500)
      .json({ message: "Failed to create order", error: error.message });
  }
};

// Get all orders for the authenticated user (buyer)
exports.getMyOrders = async (req, res) => {
  try {
    const orders = await Order.find({ buyer: req.user.id })
      .populate("items.productId", "name price")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: orders.length,
      orders,
    });
  } catch (error) {
    console.error("Error fetching orders:", error);
    res
      .status(500)
      .json({ message: "Failed to fetch orders", error: error.message });
  }
};

// Get a specific order by ID
exports.getOrderById = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate("buyer", "name email phone")
      .populate("items.productId", "name price imageUrl");

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    // Check if the user is the buyer of this order
    if (order.buyer._id.toString() !== req.user.id) {
      return res
        .status(403)
        .json({ message: "You are not authorized to view this order" });
    }

    res.status(200).json({
      success: true,
      order,
    });
  } catch (error) {
    console.error("Error fetching order:", error);
    res
      .status(500)
      .json({ message: "Failed to fetch order", error: error.message });
  }
};

// Update order status (can be extended for sellers to update)
exports.updateOrderStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const allowedStatuses = [
      "pending",
      "processing",
      "shipped",
      "delivered",
      "cancelled",
    ];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    // Check if the user is the buyer of this order
    if (order.buyer.toString() !== req.user.id) {
      return res
        .status(403)
        .json({ message: "You are not authorized to update this order" });
    }

    order.status = status;

    if (status === "delivered") {
      order.deliveryDate = new Date();
    }

    await order.save();

    res.status(200).json({
      success: true,
      message: "Order status updated successfully",
      order,
    });
  } catch (error) {
    console.error("Error updating order:", error);
    res
      .status(500)
      .json({ message: "Failed to update order", error: error.message });
  }
};

// Cancel an order
exports.cancelOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    // Check if the user is the buyer of this order
    if (order.buyer.toString() !== req.user.id) {
      return res
        .status(403)
        .json({ message: "You are not authorized to cancel this order" });
    }

    // Only allow cancellation if order is pending or processing
    if (order.status === "shipped" || order.status === "delivered") {
      return res.status(400).json({
        message: "Cannot cancel order that has been shipped or delivered",
      });
    }

    order.status = "cancelled";
    await order.save();

    res.status(200).json({
      success: true,
      message: "Order cancelled successfully",
      order,
    });
  } catch (error) {
    console.error("Error cancelling order:", error);
    res
      .status(500)
      .json({ message: "Failed to cancel order", error: error.message });
  }
};

// Get orders for seller's shop (orders containing their products)
exports.getSellerOrders = async (req, res) => {
  try {
    const User = require("../models/User");

    // Get seller's shop name
    const seller = await User.findById(req.user.id);
    if (!seller || seller.userType !== "seller") {
      return res
        .status(403)
        .json({ message: "Only sellers can access this endpoint" });
    }

    const shopName = seller.shopName;
    console.log("Fetching orders for shop:", shopName);

    // Find all orders that contain items sold by this shop
    const allOrders = await Order.find()
      .populate("buyer", "name email phone address")
      .sort({ createdAt: -1 });

    // Filter orders to only include items from this seller's shop
    const sellerOrders = [];

    for (const order of allOrders) {
      // Filter items that belong to this seller (exact match, case-insensitive)
      const sellerItems = [];
      order.items.forEach((item, originalIndex) => {
        const itemSellerName = (item.seller || "").trim().toLowerCase();
        const sellerShopName = (shopName || "").trim().toLowerCase();
        if (itemSellerName === sellerShopName) {
          // Add original index to the item so frontend can reference it correctly
          const itemObj = item.toObject ? item.toObject() : { ...item };
          itemObj.originalIndex = originalIndex;
          sellerItems.push(itemObj);
        }
      });

      if (sellerItems.length > 0) {
        // Create a new order object with only seller's items
        const orderData = {
          _id: order._id,
          buyer: order.buyer,
          items: sellerItems,
          shippingAddress: order.shippingAddress,
          paymentMethod: order.paymentMethod,
          status: order.status,
          orderDate: order.orderDate,
          createdAt: order.createdAt,
          // Calculate subtotal for seller's items only
          subtotal: sellerItems.reduce(
            (sum, item) => sum + item.price * item.quantity,
            0
          ),
        };

        sellerOrders.push(orderData);
      }
    }

    // Group orders by customer
    const ordersByCustomer = {};
    sellerOrders.forEach((order) => {
      const customerId = order.buyer._id.toString();
      if (!ordersByCustomer[customerId]) {
        ordersByCustomer[customerId] = {
          customer: order.buyer,
          orders: [],
          totalOrders: 0,
          totalAmount: 0,
        };
      }
      ordersByCustomer[customerId].orders.push(order);
      ordersByCustomer[customerId].totalOrders += 1;
      ordersByCustomer[customerId].totalAmount += order.subtotal;
    });

    // Convert to array
    const groupedOrders = Object.values(ordersByCustomer);

    console.log(`Found ${sellerOrders.length} orders for shop ${shopName}`);

    res.status(200).json({
      success: true,
      count: sellerOrders.length,
      orders: sellerOrders,
      groupedByCustomer: groupedOrders,
    });
  } catch (error) {
    console.error("Error fetching seller orders:", error);
    res
      .status(500)
      .json({ message: "Failed to fetch orders", error: error.message });
  }
};

// Update individual item status in an order (for sellers)
exports.updateItemStatus = async (req, res) => {
  try {
    const { orderId, itemIndex } = req.params;
    const { status } = req.body;

    // Convert itemIndex to number
    const itemIndexNum = parseInt(itemIndex, 10);

    const allowedStatuses = [
      "pending",
      "processing",
      "shipped",
      "delivered",
      "cancelled",
    ];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    if (isNaN(itemIndexNum)) {
      return res.status(400).json({ message: "Invalid item index" });
    }

    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    // Check if item index is valid
    if (itemIndexNum < 0 || itemIndexNum >= order.items.length) {
      return res.status(400).json({ message: "Invalid item index" });
    }

    console.log("Updating item status:", {
      orderId,
      itemIndex: itemIndexNum,
      newStatus: status,
      itemName: order.items[itemIndexNum].name,
    });

    // Update the item status directly (no seller verification needed since dashboard already filters)
    order.items[itemIndexNum].status = status;

    // Update overall order status based on all items
    const allDelivered = order.items.every(
      (item) => item.status === "delivered"
    );
    const anyShipped = order.items.some((item) => item.status === "shipped");
    const anyProcessing = order.items.some(
      (item) => item.status === "processing"
    );
    const anyCancelled = order.items.some(
      (item) => item.status === "cancelled"
    );

    if (allDelivered) {
      order.status = "delivered";
      order.deliveryDate = new Date();
    } else if (anyShipped) {
      order.status = "shipped";
    } else if (anyProcessing) {
      order.status = "processing";
    } else if (
      anyCancelled &&
      order.items.every(
        (item) => item.status === "cancelled" || item.status === "delivered"
      )
    ) {
      order.status = "cancelled";
    }

    await order.save();

    res.status(200).json({
      success: true,
      message: "Item status updated successfully",
      order,
    });
  } catch (error) {
    console.error("Error updating item status:", error);
    res.status(500).json({
      message: "Failed to update item status",
      error: error.message,
    });
  }
};
