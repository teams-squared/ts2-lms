import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// Mock next-auth/react — use vi.hoisted so the fn is available before vi.mock hoists
const { mockSignIn } = vi.hoisted(() => ({ mockSignIn: vi.fn() }));
vi.mock("next-auth/react", () => ({
  signIn: mockSignIn,
}));

import LoginForm from "@/components/auth/LoginForm";

describe("LoginForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows only Microsoft button in production with Microsoft provider", () => {
    render(<LoginForm hasMicrosoftProvider={true} isProduction={true} />);
    expect(screen.getByText("Sign in with Microsoft")).toBeInTheDocument();
    expect(screen.queryByLabelText("Email")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Password")).not.toBeInTheDocument();
  });

  it("shows credential form only when no Microsoft provider in dev", () => {
    render(<LoginForm hasMicrosoftProvider={false} isProduction={false} />);
    expect(screen.queryByText("Sign in with Microsoft")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
  });

  it("shows both with divider when dev + Microsoft", () => {
    render(<LoginForm hasMicrosoftProvider={true} isProduction={false} />);
    expect(screen.getByText("Sign in with Microsoft")).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByText("or sign in with email")).toBeInTheDocument();
  });

  it("calls signIn with credentials on form submission", async () => {
    mockSignIn.mockResolvedValue({ error: null, url: "/" });
    const user = userEvent.setup();

    render(<LoginForm hasMicrosoftProvider={false} isProduction={false} />);

    await user.type(screen.getByLabelText("Email"), "test@test.com");
    await user.type(screen.getByLabelText("Password"), "password123");
    await user.click(screen.getByRole("button", { name: "Sign In" }));

    expect(mockSignIn).toHaveBeenCalledWith("credentials", {
      email: "test@test.com",
      password: "password123",
      callbackUrl: "/",
      redirect: false,
    });
  });

  it("displays error on failed sign in", async () => {
    mockSignIn.mockResolvedValue({ error: "CredentialsSignin" });
    const user = userEvent.setup();

    render(<LoginForm hasMicrosoftProvider={false} isProduction={false} />);

    await user.type(screen.getByLabelText("Email"), "bad@test.com");
    await user.type(screen.getByLabelText("Password"), "wrong");
    await user.click(screen.getByRole("button", { name: "Sign In" }));

    expect(await screen.findByText("Invalid email or password")).toBeInTheDocument();
  });

  it("shows loading state during sign in", async () => {
    // Never resolve so we stay in loading state
    mockSignIn.mockReturnValue(new Promise(() => {}));
    const user = userEvent.setup();

    render(<LoginForm hasMicrosoftProvider={false} isProduction={false} />);

    await user.type(screen.getByLabelText("Email"), "test@test.com");
    await user.type(screen.getByLabelText("Password"), "pass");
    await user.click(screen.getByRole("button", { name: "Sign In" }));

    expect(screen.getByText(/Signing in/)).toBeInTheDocument();
  });
});
