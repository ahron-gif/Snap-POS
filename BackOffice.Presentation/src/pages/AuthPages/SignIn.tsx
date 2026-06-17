import PageMeta from "../../components/common/PageMeta";
import AuthLayout from "./AuthPageLayout";
import SignInForm from "../../components/auth/SignInForm";

export default function SignIn() {
  return (
    <>
      <PageMeta
        title="RDT BackOffice - Sign In"
        description="This is RDT BackOffice Dashboard page for managing and empowering business with seamless, efficient, and secure operations."
      />
      <AuthLayout>
        <SignInForm />
      </AuthLayout>
    </>
  );
}
