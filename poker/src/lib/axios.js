import axios from "axios";
import supabase from "../../supabaseClient";

let token = localStorage.getItem(`sb-${supabase.supabaseKey}-auth-token`);
export const api = axios.create({
  baseURL: "https://poker-production-71d8.up.railway.app", // Change to your API base URL
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  },
});
