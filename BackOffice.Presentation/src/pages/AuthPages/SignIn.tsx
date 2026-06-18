import PageMeta from "../../components/common/PageMeta";
import AuthLayout from "./AuthPageLayout";
import SignInForm from "../../components/auth/SignInForm";

export default function SignIn() {
  return (
    <>
      <PageMeta
        title="Snap POS - Sign In"
        description="Sign in to Snap Point of Sale Back Office to manage your business operations."
      />
      <AuthLayout>
        <SignInForm />
      </AuthLayout>
    </>
  );
}
