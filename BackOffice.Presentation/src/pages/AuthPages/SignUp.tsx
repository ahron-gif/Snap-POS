import PageMeta from "../../components/common/PageMeta";
import AuthLayout from "./AuthPageLayout";
import SignUpForm from "../../components/auth/SignUpForm";

export default function SignUp() {
  return (
    <>
      <PageMeta
        title="RDT BackOffice - Sign up"
        description="This is RDT BackOffice Dashboard page for managing and empowering business with seamless, efficient, and secure operations."
      />
      <AuthLayout>
        <SignUpForm />
      </AuthLayout>
    </>
  );
}
