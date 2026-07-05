import axios from "axios";
import supabase from "../../supabaseClient";

let token = localStorage.getItem(`sb-${supabase.supabaseKey}-auth-token`);
export const api = axios.create({
  baseURL: import.meta.env.VITE_BASE_URL,
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  },
});
