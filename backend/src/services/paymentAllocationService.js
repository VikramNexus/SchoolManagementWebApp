/**
 * Payment Allocation Service — School Management System
 *
 * Day 6 & Day 7: Fee Engine & Payment Reversals.
 *
 * Implements FIFO (First In, First Out) cash payment allocation and reversal:
 * - Lock unpaid/partial monthly fees with FOR UPDATE
 * - Order by fee_year ASC, fee_month ASC (oldest first)
 * - Allocate cash to oldest dues first
 * - Update paid_amount, due_amount, status
 * - Insert payment_allocations records
 * - Revert allocations on payment edit
 */

const db = require('../config/db');
const { withTransaction } = require('../utils/transactionHandler');

/**
 * Allocate a cash payment to a student's monthly & additional fees using FIFO
 */
async function allocatePaymentFIFO({ studentId, paymentId, amount }, existingTx = null) {
  if (amount <= 0) {
    throw new Error('Payment amount must be greater than 0');
  }

  const runAllocation = async (tx) => {
    // 1. Lock and fetch oldest unpaid/partial monthly fees for this student
    const [monthlyFees] = await tx.execute(
      `SELECT \`id\`, \`fee_month\`, \`fee_year\`, \`fee_amount\`, \`paid_amount\`, \`due_amount\`, \`status\`
       FROM \`monthly_fees\`
       WHERE \`student_id\` = ? AND \`status\` IN ('DUE', 'PARTIAL')
       ORDER BY \`fee_year\` ASC, \`fee_month\` ASC
       FOR UPDATE`,
      [studentId]
    );

    let remainingCash = Number(amount);
    const allocations = [];

    // 2. Allocate to each monthly fee in FIFO order
    for (const fee of monthlyFees) {
      if (remainingCash <= 0) break;

      const dueAmount = Number(fee.due_amount);
      const allocation = Math.min(remainingCash, dueAmount);

      if (allocation <= 0) continue;

      // 3. Update monthly_fees
      const newPaidAmount = Number(fee.paid_amount) + allocation;
      const newDueAmount = dueAmount - allocation;
      const newStatus = newDueAmount === 0 ? 'PAID' : 'PARTIAL';

      await tx.execute(
        `UPDATE \`monthly_fees\`
         SET \`paid_amount\` = ?, \`due_amount\` = ?, \`status\` = ?
         WHERE \`id\` = ?`,
        [newPaidAmount, newDueAmount, newStatus, fee.id]
      );

      // 4. Insert payment_allocation record
      const [allocResult] = await tx.execute(
        `INSERT INTO \`payment_allocations\` (\`payment_id\`, \`monthly_fee_id\`, \`allocated_amount\`)
         VALUES (?, ?, ?)`,
        [paymentId, fee.id, allocation]
      );

      allocations.push({
        allocationId: allocResult.insertId,
        monthlyFeeId: fee.id,
        feeMonth: fee.fee_month,
        feeYear: fee.fee_year,
        allocatedAmount: allocation,
        previousStatus: fee.status,
        newStatus,
        newPaidAmount,
        newDueAmount,
      });

      remainingCash -= allocation;
    }

    // 5. If there's still remaining cash, allocate to additional custom / admission fees
    if (remainingCash > 0) {
      const [additionalFees] = await tx.execute(
        `SELECT \`id\`, \`amount\`, \`paid_amount\`, \`discount_amount\`, \`status\`
         FROM \`student_additional_fees\`
         WHERE \`student_id\` = ? AND \`status\` IN ('DUE', 'PARTIAL')
         ORDER BY \`created_at\` ASC
         FOR UPDATE`,
        [studentId]
      );

      for (const fee of additionalFees) {
        if (remainingCash <= 0) break;

        const totalFeeAmount = Number(fee.amount || 0);
        const currentPaid = Number(fee.paid_amount || 0);
        const currentDiscount = Number(fee.discount_amount || 0);
        const netDue = Math.max(0, totalFeeAmount - currentPaid - currentDiscount);

        if (netDue <= 0) continue;

        const allocation = Math.min(remainingCash, netDue);
        if (allocation <= 0) continue;

        const newPaidAmount = currentPaid + allocation;
        const newStatus = (newPaidAmount + currentDiscount) >= totalFeeAmount ? 'PAID' : 'PARTIAL';

        await tx.execute(
          `UPDATE \`student_additional_fees\`
           SET \`paid_amount\` = ?, \`status\` = ?
           WHERE \`id\` = ?`,
          [newPaidAmount, newStatus, fee.id]
        );

        // Record allocation linking to additional_fee_id
        const [allocResult] = await tx.execute(
          `INSERT INTO \`payment_allocations\` (\`payment_id\`, \`monthly_fee_id\`, \`additional_fee_id\`, \`allocated_amount\`)
           VALUES (?, NULL, ?, ?)`,
          [paymentId, fee.id, allocation]
        );

        allocations.push({
          allocationId: allocResult.insertId,
          additionalFeeId: fee.id,
          allocatedAmount: allocation,
          previousStatus: fee.status,
          newStatus,
          newPaidAmount,
        });

        remainingCash -= allocation;
      }
    }

    return {
      success: true,
      originalAmount: amount,
      allocatedAmount: amount - remainingCash,
      remainingCash,
      allocations,
    };
  };

  if (existingTx) {
    return await runAllocation(existingTx);
  }

  return await withTransaction(runAllocation);
}

/**
 * Revert previous allocations for a payment ID (both monthly fees and additional/admission fees)
 */
async function revertPaymentAllocations(paymentId, tx) {
  // 1. Fetch all allocations for this payment
  const [allocations] = await tx.execute(
    `SELECT \`monthly_fee_id\`, \`additional_fee_id\`, \`allocated_amount\`
     FROM \`payment_allocations\`
     WHERE \`payment_id\` = ?`,
    [paymentId]
  );

  for (const alloc of allocations) {
    if (alloc.monthly_fee_id) {
      const [fees] = await tx.execute(
        `SELECT \`fee_amount\`, \`paid_amount\`, \`due_amount\`
         FROM \`monthly_fees\` WHERE \`id\` = ?`,
        [alloc.monthly_fee_id]
      );
      if (fees && fees.length > 0) {
        const fee = fees[0];
        const newPaidAmount = Math.max(0, Number(fee.paid_amount) - Number(alloc.allocated_amount));
        const newDueAmount = Number(fee.fee_amount) - newPaidAmount;
        const newStatus = newPaidAmount === 0 ? 'DUE' : (newDueAmount === 0 ? 'PAID' : 'PARTIAL');

        await tx.execute(
          `UPDATE \`monthly_fees\`
           SET \`paid_amount\` = ?, \`due_amount\` = ?, \`status\` = ?
           WHERE \`id\` = ?`,
          [newPaidAmount, newDueAmount, newStatus, alloc.monthly_fee_id]
        );
      }
    }

    if (alloc.additional_fee_id) {
      const [addFees] = await tx.execute(
        `SELECT \`amount\`, \`paid_amount\`, \`discount_amount\`
         FROM \`student_additional_fees\` WHERE \`id\` = ?`,
        [alloc.additional_fee_id]
      );
      if (addFees && addFees.length > 0) {
        const addFee = addFees[0];
        const newPaid = Math.max(0, Number(addFee.paid_amount || 0) - Number(alloc.allocated_amount));
        const totalAmount = Number(addFee.amount || 0);
        const discountAmount = Number(addFee.discount_amount || 0);
        const newStatus = (newPaid + discountAmount) >= totalAmount ? 'PAID' : (newPaid > 0 ? 'PARTIAL' : 'DUE');

        await tx.execute(
          `UPDATE \`student_additional_fees\`
           SET \`paid_amount\` = ?, \`status\` = ?
           WHERE \`id\` = ?`,
          [newPaid, newStatus, alloc.additional_fee_id]
        );
      }
    }
  }

  // 2. Delete the payment allocations
  await tx.execute(
    `DELETE FROM \`payment_allocations\` WHERE \`payment_id\` = ?`,
    [paymentId]
  );
}

/**
 * Check if a student has any pending/unpaid fees
 */
async function canAllocatePayment(studentId) {
  const monthlyFees = await db.queryOne(
    `SELECT COUNT(*) as count FROM \`monthly_fees\`
     WHERE \`student_id\` = ? AND \`status\` IN ('DUE', 'PARTIAL') AND \`due_amount\` > 0`,
    [studentId]
  );

  const additionalFees = await db.queryOne(
    `SELECT COUNT(*) as count FROM \`student_additional_fees\`
     WHERE \`student_id\` = ? AND \`status\` IN ('DUE', 'PARTIAL') AND (\`amount\` - \`paid_amount\` - \`discount_amount\`) > 0`,
    [studentId]
  );

  return ((monthlyFees?.count || 0) + (additionalFees?.count || 0)) > 0;
}

/**
 * Get total outstanding amount for a student
 */
async function getTotalOutstanding(studentId) {
  const monthlyTotal = await db.queryOne(
    `SELECT COALESCE(SUM(\`due_amount\`), 0) as total FROM \`monthly_fees\`
     WHERE \`student_id\` = ? AND \`status\` IN ('DUE', 'PARTIAL')`,
    [studentId]
  );

  const additionalTotal = await db.queryOne(
    `SELECT COALESCE(SUM(GREATEST(0, \`amount\` - \`paid_amount\` - \`discount_amount\`)), 0) as total
     FROM \`student_additional_fees\`
     WHERE \`student_id\` = ? AND \`status\` IN ('DUE', 'PARTIAL')`,
    [studentId]
  );

  return Number(monthlyTotal?.total || 0) + Number(additionalTotal?.total || 0);
}

module.exports = {
  allocatePaymentFIFO,
  revertPaymentAllocations,
  canAllocatePayment,
  getTotalOutstanding,
};