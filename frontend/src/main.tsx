import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router";
import App from "./App";
import { ToastProvider } from "./components/overlay/Toast";
import { AuthProvider } from "./features/auth/AuthContext";
import { SessionTimeoutProvider } from "./features/auth/SessionTimeoutProvider";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <SessionTimeoutProvider>
          <ToastProvider>
            <App />
          </ToastProvider>
        </SessionTimeoutProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
