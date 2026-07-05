import axios from "axios";
import supabase from "../../supabaseClient";

let token = localStorage.getItem(`sb-${supabase.supabaseKey}-auth-token`);
export const api = axios.create({
  baseURL: "https://poker-server.rohanupreti4.workers.dev",
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  },
});
