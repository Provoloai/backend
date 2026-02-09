/**
 * Script to export users with pending payment status to CSV for review.
 *
 * This script:
 * 1. Connects to Polar API to get all orders
 * 2. Cross-references with Firebase users
 * 3. Exports a CSV with user info, payment status, and current tier
 *
 * Usage: npx tsx src/scripts/export-pending-users.ts
 */

import { getFirestore } from "firebase-admin/firestore";
import { getFirebaseApp, closeFirebaseApp } from "../utils/getFirebaseApp.ts";
import { createPolar } from "../utils/polarClient.ts";
import * as fs from "fs";
import * as path from "path";

interface ExportRow {
  orderId: string;
  polarStatus: string;
  orderCreatedAt: string;
  customerId: string;
  customerEmail: string;
  userId: string;
  userFoundInDb: boolean;
  currentTier: string;
  productName: string;
  amount: string;
  needsReview: boolean;
  notes: string;
}

const PREMIUM_TIERS = ["plus", "plusAnnual"];

async function exportPendingUsers() {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`Export Pending Users to CSV`);
  console.log(`Started at: ${new Date().toISOString()}`);
  console.log(`${"=".repeat(60)}\n`);

  const app = getFirebaseApp();
  const db = getFirestore(app);
  const polar = createPolar();

  const rows: ExportRow[] = [];
  let page = 1;
  let hasMore = true;
  let totalOrders = 0;

  try {
    console.log("Fetching orders from Polar...\n");

    while (hasMore) {
      const response = await polar.orders.list({
        organizationId: process.env.POLAR_ORG_ID,
        page,
        limit: 100,
      });

      const orders = response.result?.items || [];

      if (orders.length === 0) {
        hasMore = false;
        break;
      }

      totalOrders += orders.length;

      for (const order of orders) {
        const orderId = order.id;
        const polarStatus = order.status || "unknown";
        const orderCreatedAt = order.createdAt?.toString() || "";
        const customerId = order.customerId || "";
        const customerEmail = order.customer?.email || "";
        const productName = order.product?.name || "";
        // Cast to any since SDK types may not include all fields
        const orderAny = order as any;
        const amount = orderAny.amount
          ? `$${(orderAny.amount / 100).toFixed(2)}`
          : orderAny.taxAmount
            ? `$${(orderAny.taxAmount / 100).toFixed(2)}`
            : "N/A";
        const metadata = order.metadata as Record<string, any> | null;
        const userIdFromMetadata = metadata?.user_id || "";

        // Find user in Firebase
        let userDoc = null;
        let actualUserId = userIdFromMetadata;
        let currentTier = "";
        let userFoundInDb = false;

        // Try by userId from metadata
        if (userIdFromMetadata) {
          const userQuery = db
            .collection("users")
            .where("userId", "==", userIdFromMetadata)
            .limit(1);
          const userDocs = await userQuery.get();
          if (!userDocs.empty && userDocs.docs[0]) {
            userDoc = userDocs.docs[0];
            userFoundInDb = true;
          }
        }

        // Fallback: search by email
        if (!userDoc && customerEmail) {
          const userQuery = db
            .collection("users")
            .where("email", "==", customerEmail)
            .limit(1);
          const userDocs = await userQuery.get();
          if (!userDocs.empty && userDocs.docs[0]) {
            userDoc = userDocs.docs[0];
            userFoundInDb = true;
          }
        }

        // Fallback: search by polarId
        if (!userDoc && customerId) {
          const userQuery = db
            .collection("users")
            .where("polarId", "==", customerId)
            .limit(1);
          const userDocs = await userQuery.get();
          if (!userDocs.empty && userDocs.docs[0]) {
            userDoc = userDocs.docs[0];
            userFoundInDb = true;
          }
        }

        if (userDoc) {
          const userData = userDoc.data();
          actualUserId = userData?.userId || actualUserId;
          currentTier = userData?.tierId || "unknown";
        }

        // Determine if this needs review
        // Needs review if: status is pending AND user has premium tier
        const isPending = polarStatus === "pending";
        const hasPremiumTier = PREMIUM_TIERS.includes(currentTier);
        const needsReview = isPending && hasPremiumTier;

        let notes = "";
        if (isPending && hasPremiumTier) {
          notes = "⚠️ PENDING payment but has PREMIUM access - needs downgrade";
        } else if (isPending && !hasPremiumTier) {
          notes = "Pending payment, already on free tier - OK";
        } else if (!isPending && hasPremiumTier) {
          notes = "Payment successful, premium access - OK";
        } else if (!userFoundInDb) {
          notes = "User not found in database";
        }

        rows.push({
          orderId,
          polarStatus,
          orderCreatedAt,
          customerId,
          customerEmail,
          userId: actualUserId,
          userFoundInDb,
          currentTier,
          productName,
          amount,
          needsReview,
          notes,
        });
      }

      // Check pagination
      if (response.result?.pagination?.maxPage) {
        hasMore = page < response.result.pagination.maxPage;
        page++;
      } else {
        hasMore = orders.length === 100;
        page++;
      }

      console.log(`Processed ${totalOrders} orders...`);
    }

    // Sort rows: pending with premium first, then by date
    rows.sort((a, b) => {
      if (a.needsReview && !b.needsReview) return -1;
      if (!a.needsReview && b.needsReview) return 1;
      return (
        new Date(b.orderCreatedAt).getTime() -
        new Date(a.orderCreatedAt).getTime()
      );
    });

    // Generate CSV
    const csvHeaders = [
      "Order ID",
      "Polar Status",
      "Order Date",
      "Customer ID",
      "Customer Email",
      "User ID",
      "Found in DB",
      "Current Tier",
      "Product",
      "Amount",
      "Needs Review",
      "Notes",
    ];

    const csvRows = rows.map((row) => [
      row.orderId,
      row.polarStatus,
      row.orderCreatedAt,
      row.customerId,
      row.customerEmail,
      row.userId,
      row.userFoundInDb ? "Yes" : "No",
      row.currentTier,
      row.productName,
      row.amount,
      row.needsReview ? "YES" : "No",
      row.notes,
    ]);

    // Escape CSV fields
    const escapeCSV = (field: string) => {
      if (field.includes(",") || field.includes('"') || field.includes("\n")) {
        return `"${field.replace(/"/g, '""')}"`;
      }
      return field;
    };

    const csvContent = [
      csvHeaders.join(","),
      ...csvRows.map((row) => row.map(escapeCSV).join(",")),
    ].join("\n");

    // Save to file
    const timestamp = new Date()
      .toISOString()
      .replace(/[:.]/g, "-")
      .slice(0, 19);
    const filename = `pending-users-export-${timestamp}.csv`;
    const outputPath = path.join(process.cwd(), filename);

    fs.writeFileSync(outputPath, csvContent, "utf-8");

    // Print summary
    console.log(`\n${"=".repeat(60)}`);
    console.log("SUMMARY");
    console.log(`${"=".repeat(60)}`);

    const pendingWithPremium = rows.filter((r) => r.needsReview);
    const pendingWithoutPremium = rows.filter(
      (r) => r.polarStatus === "pending" && !r.needsReview,
    );
    const successful = rows.filter(
      (r) => r.polarStatus !== "pending" && r.userFoundInDb,
    );

    console.log(`Total orders processed: ${rows.length}`);
    console.log(
      `\n🔴 NEEDS REVIEW (pending + premium tier): ${pendingWithPremium.length}`,
    );
    console.log(
      `🟡 Pending but already on free tier: ${pendingWithoutPremium.length}`,
    );
    console.log(`🟢 Successfully paid: ${successful.length}`);

    if (pendingWithPremium.length > 0) {
      console.log(`\n⚠️  Users that need to be downgraded:`);
      for (const r of pendingWithPremium) {
        console.log(
          `  - ${r.customerEmail} | Tier: ${r.currentTier} | Order: ${r.orderId}`,
        );
      }
    }

    console.log(`\n📁 CSV exported to: ${outputPath}`);
    console.log(`\nCompleted at: ${new Date().toISOString()}`);
  } catch (err: any) {
    console.error("Fatal error:", err);
    throw err;
  } finally {
    closeFirebaseApp();
  }

  return rows;
}

// Main execution
exportPendingUsers()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error("Script failed:", err);
    process.exit(1);
  });
