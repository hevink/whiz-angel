const express = require("express");
const router = express.Router();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const User = require("../models/usersModel");

router.post("/create-checkout-session", async (req, res) => {
  const { quantity, price, plan } = req.body;

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: plan,
            },
            unit_amount: price,
          },
          quantity,
        },
      ],
      mode: "payment",
      success_url: `${process.env.FRONTEND_URL}/order-confirmation?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL}/order-confirmation?session_id={CHECKOUT_SESSION_ID}`,
    });
    res.status(200).json({ id: session.id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/complete-payment", async (req, res) => {
  const { sessionId, userId } = req.query;

  console.log("Session ID: ", sessionId);

  try {
    const [session, lineItems] = await Promise.all([
      stripe.checkout.sessions.retrieve(sessionId),
      stripe.checkout.sessions.listLineItems(sessionId),
    ]);

    if (session.payment_status === "paid") {
      // Update user details in the database
      await User.findByIdAndUpdate(userId, {
        $set: {
          subscriptionStatus: "active",
          lastPaymentDate: new Date(session.payment_intent.created * 1000),
          subscriptionPlan: lineItems.data[0].description,
          stripeSessionId: session.id,
          paymentStatus: session.payment_status,
          amountTotal: session.amount_total,
          currency: session.currency,
          paymentIntentId: session.payment_intent,
          paymentMethodTypes: session.payment_method_types,
          paymentDate: new Date(session.payment_intent.created * 1000),
          lineItems: lineItems.data.map((item) => ({
            id: item.id,
            description: item.description,
            amountTotal: item.amount_total,
            quantity: item.quantity,
            currency: item.currency,
          })),
          paymentData: { session, lineItems },
        },
      });
    }
    res.status(200).json({ session, lineItems });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// router.post(
//   "/webhook",
//   express.raw({ type: "application/json" }),
//   async (req, res) => {
//     const endpointSecret = process.env.STRIPE_SECRET_WEBHOOK_KEY;
//     const sig = req.headers["stripe-signature"];
//     let event;

//     try {
//       event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
//     } catch (err) {
//       return res.status(400).send(`Webhook Error: ${err.message}`);
//     }

//     const eventType = event.type;
//     if (
//       eventType !== "checkout.session.completed" &&
//       eventType !== "checkout.session.async_payment_succeeded"
//     ) {
//       return res.status(500).send("Server Error");
//     }

//     const data = event.data.object;
//     const metadata = data.metadata;
//     const transactionDetails = {
//       userId: metadata.userId,
//       priceId: metadata.priceId,
//       created: data.created,
//       currency: data.currency,
//       customerDetails: data.customer_details,
//       amount: data.amount_total,
//     };

//     try {
//       // TODO: Update your database with transactionDetails
//       console.log("Transaction details: ", transactionDetails);
//       res.status(200).send("Subscription added");
//     } catch (error) {
//       res.status(500).send("Server error");
//     }
//   }
// );

module.exports = router; // Ensure router is properly exported
