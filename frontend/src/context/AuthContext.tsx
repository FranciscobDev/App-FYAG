import React, { createContext, useContext, useState } from "react";
import { Role, User } from "@/core/types";
import { USERS } from "@/data/mock";

interface AuthContextType {
  currentRole: Role;
  user: User;
  setRole: (role: Role) => void;
}

const AuthContext = createContext<AuthContextType>({
  currentRole: "admin",
  user: USERS.admin,
  setRole: () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentRole, setCurrentRole] = useState<Role>("admin");

  const setRole = (role: Role) => {
    setCurrentRole(role);
  };

  const user = USERS[currentRole];

  return (
    <AuthContext.Provider value={{ currentRole, user, setRole }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
