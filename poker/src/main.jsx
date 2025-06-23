import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import { Toaster } from "sonner";
import { AuthProvider } from "./context/authProvider.jsx";
import { LobbyDataProvider } from "./context/lobbyData.jsx";

createRoot(document.getElementById("root")).render(
  <AuthProvider>
    <LobbyDataProvider>
      <App />
      <Toaster richColors />
    </LobbyDataProvider>
  </AuthProvider>
);
