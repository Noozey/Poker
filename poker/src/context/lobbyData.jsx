import { createContext, useContext, useState } from "react";

export const LobbyContext = createContext();

export const useLobbyData = () => useContext(LobbyContext);

export const LobbyDataProvider = ({ children }) => {
  const [lobbyName, setLobbyName] = useState("");

  return (
    <LobbyContext.Provider value={{ lobbyName, setLobbyName }}>
      {children}
    </LobbyContext.Provider>
  );
};
