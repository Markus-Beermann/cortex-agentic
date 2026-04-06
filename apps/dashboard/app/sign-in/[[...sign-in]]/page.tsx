import { SignInClient } from "./sign-in-client";

export function generateStaticParams() {
  return [
    { "sign-in": [] },
    { "sign-in": ["sso-callback"] },
    { "sign-in": ["factor-one"] },
    { "sign-in": ["factor-two"] },
    { "sign-in": ["continue"] }
  ];
}

export default function SignInPage() {
  return <SignInClient />;
}
