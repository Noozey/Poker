import axios from "axios";
import supabase from "../../supabaseClient";

let token = localStorage.getItem(`sb-${supabase.supabaseKey}-auth-token`);
export const api = axios.create({
<<<<<<< HEAD
  baseURL: "http://localhost:3000/", // Change to your API base URL
=======
  baseURL: "http://localhost:3000/", 
>>>>>>> ee23d4e00c66de9dbe052aa62b1de9a515b4f173
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  },
});
