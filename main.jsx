import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import App from "./src/App.jsx";
import "./src/styles.css";

const convexUrl = import.meta.env.VITE_CONVEX_URL;
const client = convexUrl ? new ConvexReactClient(convexUrl) : null;

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      {client ? (
        <ConvexProvider client={client}>
          <App />
        </ConvexProvider>
      ) : (
        <App missingConvexUrl />
      )}
    </BrowserRouter>
  </React.StrictMode>
);
