import React from "react";

export default function PaywallModal({
  isOpen,
  onClose,
  featureName = "This feature",
  requiredPlan = "pro", // "pro" or "premium"
}) {
  if (!isOpen) return null;

  const isPremiumRequired = requiredPlan === "premium";

  return (
    <div className="modal-overlay" style={{ zIndex: 10000 }}>
      {/* We use inline styles for the card to ensure it looks premium regardless of App.jsx global CSS */}
      <div 
        className="modal" 
        style={{
          maxWidth: 500,
          padding: "32px",
          borderRadius: "24px",
          background: "linear-gradient(145deg, #ffffff 0%, #f8fafc 100%)",
          border: "1px solid rgba(99, 102, 241, 0.2)",
          boxShadow: "0 24px 60px -12px rgba(79, 70, 229, 0.25)",
          textAlign: "center"
        }}
      >
        <div style={{ marginBottom: "20px" }}>
          <div style={{
            width: 64, height: 64, margin: "0 auto", 
            background: isPremiumRequired ? "linear-gradient(135deg, #f59e0b, #ec4899)" : "linear-gradient(135deg, #4f67ff, #7c3aed)",
            borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 8px 24px rgba(79, 103, 255, 0.3)"
          }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              {isPremiumRequired ? (
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
              ) : (
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              )}
            </svg>
          </div>
        </div>
        
        <h2 style={{ fontSize: "1.4rem", fontWeight: 800, color: "#1e293b", marginBottom: "8px", letterSpacing: "-0.02em" }}>
          Upgrade to {isPremiumRequired ? "Premium" : "Pro"} Plan
        </h2>
        
        <p style={{ fontSize: "0.95rem", color: "#64748b", lineHeight: 1.6, marginBottom: "24px" }}>
          {featureName} is only available on the {isPremiumRequired ? "₹499/month Premium" : "₹99/month Pro"} plan. 
          Upgrade to unlock this and other advanced features!
        </p>

        <div style={{ 
          background: "#fff", 
          border: "1px solid #e2e8f0", 
          borderRadius: "16px", 
          padding: "20px",
          marginBottom: "24px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "12px"
        }}>
          <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Scan to Pay via UPI
          </div>
          
          <img 
            src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=upi://pay?pa=7073164253-2@ybl&pn=PrintMaster&am=${isPremiumRequired ? "499" : "99"}&cu=INR`} 
            alt="UPI QR Code" 
            style={{ width: 140, height: 140, borderRadius: "12px", border: "1px solid #e2e8f0", padding: "4px" }} 
          />
          
          <div style={{ fontSize: "0.9rem", color: "#334155", fontWeight: 600 }}>
            UPI ID: <span style={{ color: "#4f46e5", userSelect: "all" }}>7073164253-2@ybl</span>
          </div>
        </div>

        <div style={{ fontSize: "0.8rem", color: "#64748b", background: "#f8fafc", padding: "12px", borderRadius: "12px", marginBottom: "24px" }}>
          <strong>Note:</strong> After making the payment, please send a screenshot to <strong>+91 7073164253</strong> on WhatsApp to activate your plan.
        </div>

        <button 
          onClick={onClose}
          style={{
            background: "#f1f5f9",
            color: "#475569",
            border: "none",
            padding: "12px 24px",
            borderRadius: "12px",
            fontSize: "0.95rem",
            fontWeight: 700,
            cursor: "pointer",
            width: "100%",
            transition: "all 0.2s"
          }}
          onMouseOver={(e) => { e.currentTarget.style.background = "#e2e8f0"; e.currentTarget.style.color = "#1e293b"; }}
          onMouseOut={(e) => { e.currentTarget.style.background = "#f1f5f9"; e.currentTarget.style.color = "#475569"; }}
        >
          Close
        </button>
      </div>
    </div>
  );
}
