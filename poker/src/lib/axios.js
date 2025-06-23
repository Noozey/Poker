import axios from "axios";
import supabase from "../../supabaseClient";

let token = localStorage.getItem(`sb-${supabase.supabaseKey}-auth-token`);
export const api = axios.create({
  baseURL: "http://localhost:3000", // Change to your API base URL
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  },
});
