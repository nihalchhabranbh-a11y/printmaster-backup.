/**
 * Task 5.1 – Thin Context Layer
 *
 * Strategy: App.jsx owns and manages all state as before.
 * These context objects expose that state to *any* descendant via
 * useAuth() / useData() hooks — eliminating the need to prop-drill
 * through intermediate components. State is moved here incrementally
 * in future phases; for now it's a clean zero-risk bridge.
 *
 * Usage in App.jsx:
 *   <AppProvider auth={...} data={...}>
 *     {children}
 *   </AppProvider>
 *
 * Usage in any child:
 *   const { user, setUser, setPage } = useAuth();
 *   const { bills, setBills, customers } = useData();
 */

import { createContext, useContext } from "react";

// ─── Auth Context ────────────────────────────────────────────────────────────
export const AuthContext = createContext(null);

/** Returns { user, setUser, page, setPage, dark, setDark, showToast, ... } */
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AppProvider>");
  return ctx;
}

// ─── Data Context ────────────────────────────────────────────────────────────
export const DataContext = createContext(null);

/**
 * Returns {
 *   bills, setBills, customers, setCustomers, workers, setWorkers,
 *   vendors, setVendors, tasks, setTasks, purchases, setPurchases,
 *   products, setProducts, vendorBills, setVendorBills,
 *   billPayments, setBillPayments, vendorPayments, setVendorPayments,
 *   organisations, setOrganisations, brand, setBrand, dbLoading
 * }
 */
export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData must be used inside <AppProvider>");
  return ctx;
}

// ─── Combined Provider ───────────────────────────────────────────────────────
/**
 * <AppProvider auth={authValue} data={dataValue}>
 *   {children}
 * </AppProvider>
 *
 * auth  — object matching the AuthContext shape
 * data  — object matching the DataContext shape
 */
export function AppProvider({ auth, data, children }) {
  return (
    <AuthContext.Provider value={auth}>
      <DataContext.Provider value={data}>
        {children}
      </DataContext.Provider>
    </AuthContext.Provider>
  );
}
