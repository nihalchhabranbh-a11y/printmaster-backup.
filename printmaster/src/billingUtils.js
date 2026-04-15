import { roundCurrency } from "./lib/money.js";

export const getBillPaymentInfo = (bill, billPayments) => {
  const payments = (billPayments || []).filter((p) => (p.billId || p.bill_id) === bill.id);
  const paidAmount = payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  const total = Number(bill.total) || 0;
  const hasPayments = payments.length > 0;

  const remaining = hasPayments ? Math.max(0, total - paidAmount) : bill.paid ? 0 : total;
  const status = hasPayments
    ? paidAmount <= 0
      ? "Unpaid"
      : paidAmount >= total
      ? "Paid"
      : "Partially Paid"
    : bill.paid
    ? "Paid"
    : "Unpaid";

  const isPaid = hasPayments ? paidAmount >= total : !!bill.paid;
  const displayPaidAmount = hasPayments ? paidAmount : bill.paid ? total : 0;

  return { paidAmount: displayPaidAmount, remaining, status, isPaid };
};

export const calculatePartyBalance = (partyName, bills, billPayments, customers) => {
  let balance = 0;
  const party = customers?.find(c => c.name === partyName);
  if (party) {
    balance = Number(party.opening_balance || 0);
  }

  const partyBills = bills?.filter(b => b.customer === partyName) || [];
  partyBills.forEach(b => {
    const docType = b.docType || b.doc_type || "Sales Invoice";
    if (docType === "Payment In" || docType === "Sales Return" || docType === "Credit Note") {
        balance = roundCurrency(balance - (b.total || 0));
    } else {
        balance = roundCurrency(balance + (b.total || 0));
    }
  });

  const pPayments = billPayments?.filter(p => {
    const bill = bills?.find(b => b.id === p.bill_id || b.id === p.billId);
    return bill && bill.customer === partyName;
  }) || [];
  
  pPayments.forEach(p => { balance = roundCurrency(balance - (Number(p.amount) || 0)); });

  return balance;
};
