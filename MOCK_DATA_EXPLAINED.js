// ============================================================
// MOCK PAYMENT DATA - LOGIC EXPLANATION
// ============================================================

/**
 * WHY DO SUCCESSFUL PAYMENTS SHOW "NOT_INITIATED" SETTLEMENT?
 * 
 * This is REALISTIC and INTENTIONAL. Here's why:
 * 
 * REAL-WORLD SETTLEMENT FLOW:
 * 1. Customer pays → Payment Status = SUCCESS ✓
 * 2. Order is completed
 * 3. Settlement cycle begins (typically T+2 to T+7 days)
 * 4. Settlement Status = NOT_INITIATED (waiting for cycle)
 * 5. Platform initiates settlement → IN_PROGRESS
 * 6. Money transferred to restaurant → SETTLED
 * 
 * TIMELINE EXAMPLE:
 * - Jan 8: Order completed, Payment SUCCESS
 * - Jan 8-9: Settlement NOT_INITIATED (too recent)
 * - Jan 10-14: Settlement IN_PROGRESS (processing)
 * - Jan 15: Settlement SETTLED (money received)
 * 
 * So a successful payment can have NOT_INITIATED status for days!
 */


// ============================================================
// ENHANCED DATA GENERATION (150 transactions, 90 days)
// ============================================================

/**
 * PAYMENT STATUS DISTRIBUTION:
 * - 92% SUCCESS (order delivered, payment confirmed)
 * - 7% PENDING (COD not collected yet, or UPI/Card payment processing)
 * - 1% FAILED (rare: chargebacks, refunds after delivery, payment disputes)
 * 
 * IMPORTANT: In restaurant view, you mostly see SUCCESS and PENDING.
 * 
 * WHAT EACH STATUS MEANS:
 * 
 * SUCCESS:
 * - Order was delivered
 * - Customer paid successfully
 * - Money will be/has been settled to restaurant
 * 
 * PENDING:
 * - Order was delivered as Cash on Delivery (COD)
 * - Cash not yet deposited/collected by platform
 * - OR: Online payment is still processing (rare, usually instant)
 * 
 * FAILED (only 1% - very rare):
 * - Order WAS delivered, but payment issue occurred later
 * - Examples:
 *   • Customer disputed charge (chargeback)
 *   • Order cancelled/refunded after preparation
 *   • Fraudulent card detected post-delivery
 *   • Bank reversed the transaction
 * - Restaurant prepared/delivered but won't receive payment
 * - These are edge cases that platforms handle via dispute resolution
 */

/**
 * PAYMENT METHOD DISTRIBUTION (India-specific):
 * - 50% UPI (PhonePe, GPay, Paytm - most popular)
 * - 30% CARD (credit/debit cards)
 * - 15% WALLET (Paytm, PhonePe wallet)
 * - 5% CASH (cash on delivery)
 */

/**
 * SETTLEMENT STATUS LOGIC (for SUCCESS payments):
 * 
 * Very Recent (<3 days old):
 * - 70% NOT_INITIATED (waiting for settlement cycle)
 * - 30% IN_PROGRESS (early processing)
 * - 0% SETTLED (too soon)
 * 
 * Recent (3-7 days old):
 * - 10% NOT_INITIATED (delayed cycle start)
 * - 50% IN_PROGRESS (actively processing)
 * - 40% SETTLED (completed)
 * 
 * Old (>7 days):
 * - 0% NOT_INITIATED
 * - 5% IN_PROGRESS (rare delays)
 * - 95% SETTLED (should be done)
 */

/**
 * SETTLEMENT STATUS FOR OTHER PAYMENT STATUSES:
 * 
 * PENDING Payments:
 * - Always NOT_INITIATED
 * - Why: These are Cash on Delivery (COD) orders
 * - Cash needs to be collected first before settlement starts
 * - Once collected, status changes to SUCCESS and settlement begins
 * 
 * FAILED Payments:
 * - Always NOT_INITIATED
 * - Why: These are disputed/refunded orders
 * - Restaurant prepared/delivered but won't receive payment
 * - Platform may compensate separately (not via regular settlement)
 * - Examples: Chargeback, fraud, cancelled after delivery
 */


// ============================================================
// SETTLEMENT DATE LOGIC
// ============================================================

/**
 * WHEN IS settlementDate SET?
 * - Only when settlementStatus = 'SETTLED'
 * - Typically 3-5 days after transaction date
 * - Randomly assigned within that range for realism
 * 
 * EXAMPLES:
 * - Transaction: Jan 1
 * - Settlement: Jan 4 or Jan 5 or Jan 6
 */


// ============================================================
// PAYMENT GATEWAY ASSIGNMENT
// ============================================================

/**
 * SMART GATEWAY SELECTION:
 * 
 * UPI Payments:
 * - Razorpay, PhonePe, or Paytm
 * 
 * CARD Payments:
 * - Razorpay or Paytm
 * 
 * WALLET Payments:
 * - Paytm or PhonePe
 * 
 * CASH Payments:
 * - Always "Cash" (no gateway)
 */


// ============================================================
// ORDER AMOUNT REALISM
// ============================================================

/**
 * ORDER VALUE RANGE: ₹150 - ₹2,500
 * 
 * This matches typical food delivery orders:
 * - Small order: ₹150-400 (1 person, snack)
 * - Medium order: ₹400-800 (1-2 people, meal)
 * - Large order: ₹800-1,500 (family, party)
 * - Bulk order: ₹1,500-2,500 (office, event)
 */


// ============================================================
// COMMISSION & TAX CALCULATION
// ============================================================

/**
 * COMMISSION: 18% of gross amount
 * TAX: 18% GST on commission (not on gross)
 * NET PAYOUT: Gross - Commission - Tax
 * 
 * EXAMPLE:
 * Gross Amount: ₹1,000
 * Commission (18%): ₹180
 * Tax (18% of ₹180): ₹32.40
 * Net Payout: ₹1,000 - ₹180 - ₹32.40 = ₹787.60
 */


// ============================================================
// TRANSACTION ID UNIQUENESS
// ============================================================

/**
 * FORMAT: TXN_{timestamp}_{random}_{index}
 * 
 * This ensures:
 * - No duplicate IDs
 * - Sortable by time
 * - Easy to debug
 * 
 * EXAMPLE: TXN_1704844800000_45678_23
 */


// ============================================================
// DATA VOLUME & DENSITY
// ============================================================

/**
 * WHY 150 TRANSACTIONS?
 * - 90 days coverage
 * - ~1.67 transactions per day (realistic for mid-size restaurant)
 * - Enough data to test filters and sorting
 * - Not so much that it slows down the UI
 * 
 * DISTRIBUTION OVER TIME:
 * - Random spread across 90 days
 * - Some days have multiple orders
 * - Some days have none (realistic)
 */


// ============================================================
// COMMON SCENARIOS YOU'LL SEE
// ============================================================

/**
 * SCENARIO 1: Recent Successful Order
 * Payment Status: SUCCESS ✓
 * Settlement Status: NOT_INITIATED ○
 * WHY: Too recent, waiting for settlement cycle
 * EXPECTED: Normal
 * 
 * SCENARIO 2: Processing Settlement
 * Payment Status: SUCCESS ✓
 * Settlement Status: IN_PROGRESS ⏳
 * WHY: Settlement cycle started, money in transit
 * EXPECTED: Normal
 * 
 * SCENARIO 3: Completed Transaction
 * Payment Status: SUCCESS ✓
 * Settlement Status: SETTLED ✓
 * Settlement Date: [date]
 * WHY: Money transferred to restaurant
 * EXPECTED: Normal
 * 
 * SCENARIO 4: Pending Payment
 * Payment Status: PENDING ⏱
 * Settlement Status: NOT_INITIATED ○
 * WHY: Payment not confirmed yet
 * EXPECTED: Normal (customer may still pay)
 * 
 * SCENARIO 5: Disputed Payment (Very Rare - 1%)
 * Payment Status: FAILED ✗
 * Settlement Status: NOT_INITIATED ○
 * WHY: Order was delivered but customer disputed charge (chargeback)
 *      OR order cancelled/refunded after preparation
 * EXPECTED: Rare edge case (platform handles separately)
 * ACTION: Contact platform support for resolution
 */


// ============================================================
// DASHBOARD CALCULATIONS
// ============================================================

/**
 * TODAY'S EARNINGS:
 * Sum of netPayoutAmount for SUCCESS payments created today
 * 
 * THIS WEEK'S EARNINGS:
 * Sum of netPayoutAmount for SUCCESS payments in last 7 days
 * 
 * THIS MONTH'S EARNINGS:
 * Sum of netPayoutAmount for SUCCESS payments this calendar month
 * 
 * PENDING SETTLEMENTS:
 * Sum of netPayoutAmount for SUCCESS payments with:
 * - settlementStatus = NOT_INITIATED OR IN_PROGRESS
 * (This is money earned but not yet received)
 */


// ============================================================
// FILTER EXAMPLES
// ============================================================

/**
 * TO SEE ONLY SETTLED PAYMENTS:
 * Settlement Status Filter → Select "Settled"
 * Result: Only payments with money already transferred
 * 
 * TO SEE PENDING MONEY:
 * Payment Status → Select "Success"
 * Settlement Status → Select "Not Initiated", "In Progress"
 * Result: Money you've earned but haven't received yet
 * 
 * TO SEE FAILED ORDERS:
 * Payment Status → Select "Failed"
 * Result: Orders that didn't go through
 * 
 * TO SEE THIS WEEK'S SETTLEMENTS:
 * Date Range → Last 7 days
 * Settlement Status → Select "Settled"
 * Result: Money received in the last week
 */


// ============================================================
// TROUBLESHOOTING DATA QUESTIONS
// ============================================================

/**
 * Q: Why do I see SUCCESS payments not settled?
 * A: Normal! Settlement takes 3-7 days typically.
 * 
 * Q: Why are old payments still IN_PROGRESS?
 * A: Simulated 5% delay rate for realism. Real banks have delays too.
 * 
 * Q: Why do PENDING payments never settle?
 * A: Correct! Can't settle money we haven't received yet.
 * 
 * Q: Why do FAILED payments show NOT_INITIATED?
 * A: Correct! No money to settle if payment failed.
 * 
 * Q: Why aren't amounts exact multiples of 10?
 * A: Realistic! Real orders include taxes, delivery fees, etc.
 * 
 * Q: Why do some orders have same Order IDs?
 * A: Random generation. In production, backend ensures uniqueness.
 */


// ============================================================
// REALISM CHECKLIST
// ============================================================

/*
✓ Payment methods match Indian market distribution
✓ Settlement timelines match real banking cycles
✓ Commission rate matches typical food delivery platforms
✓ Order values match typical restaurant transactions
✓ Payment success rate matches industry standards
✓ Settlement delays exist (like real platforms)
✓ Failed payments stay unsettled (realistic)
✓ Recent orders show NOT_INITIATED (expected)
✓ Transaction IDs are unique and traceable
✓ Data covers full 90-day period
*/


// ============================================================
// END OF DATA LOGIC EXPLANATION
// ============================================================
