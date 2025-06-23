import { Button } from "@/components/ui/button";
import { useAuth } from "../context/authProvider";
import logo from "../image/logo.png";
import Lobby from "../lobby";

export default function Login() {
  const { session, SignIn } = useAuth();

  return (
    <div className="flex items-center h-screen w-screen justify-center bg-gray-800 text-foreground ">
      {!session ? (
        <div className="flex flex-col items-center gap-10">
          <img src={logo} alt="Logo" className="h-86 w-86 mb-10" />
          <Button variant="outline" onClick={() => SignIn()}>
            Sign In with Google
          </Button>
        </div>
      ) : (
        <Lobby />
      )}
    </div>
  );
}
