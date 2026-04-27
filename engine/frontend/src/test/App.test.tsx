import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../App";

beforeEach(() => {
  document.documentElement.classList.remove("dark");
  localStorage.removeItem("aequitas-theme");
});

describe("Global Layout & Navigation", () => {
  it("renders the top nav with branding", () => {
    render(<App />);
    expect(screen.getByText("Aequitas-Gov")).toBeInTheDocument();
    expect(screen.getByText("Fairness Layer")).toBeInTheDocument();
  });

  it("renders all three tabs", () => {
    render(<App />);
    expect(screen.getByText("Applicant Queue")).toBeInTheDocument();
    expect(screen.getByText("Audit & Override")).toBeInTheDocument();
    expect(screen.getByText("System Metrics & MLOps")).toBeInTheDocument();
  });

  it("switches tabs when clicked", async () => {
    render(<App />);
    const user = userEvent.setup();

    expect(screen.getByText("8 of 8 applicants")).toBeInTheDocument();

    await user.click(screen.getByText("Audit & Override"));
    expect(screen.getByText("What-If Simulator")).toBeInTheDocument();

    await user.click(screen.getByText("System Metrics & MLOps"));
    expect(screen.getByText("Policy Engine Rules")).toBeInTheDocument();
  });
});

describe("Theme Switcher", () => {
  it("toggles dark mode class on document root", async () => {
    render(<App />);
    const user = userEvent.setup();

    const themeBtn = screen.getByLabelText(/switch to/i);
    expect(document.documentElement.classList.contains("dark")).toBe(false);

    await user.click(themeBtn);
    expect(document.documentElement.classList.contains("dark")).toBe(true);

    await user.click(themeBtn);
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("persists theme to localStorage", async () => {
    render(<App />);
    const user = userEvent.setup();
    const themeBtn = screen.getByLabelText(/switch to/i);

    await user.click(themeBtn);
    expect(localStorage.getItem("aequitas-theme")).toBe("dark");

    await user.click(themeBtn);
    expect(localStorage.getItem("aequitas-theme")).toBe("light");
  });
});

describe("Governance Banner", () => {
  it("shows active state by default", () => {
    render(<App />);
    expect(screen.getByText("Active Bias Correction")).toBeInTheDocument();
  });

  it("toggles governance mode", async () => {
    render(<App />);
    const user = userEvent.setup();

    const toggle = screen.getByLabelText("Toggle governance mode");
    await user.click(toggle);
    expect(screen.getByText("Exposing Raw ML Outputs")).toBeInTheDocument();

    await user.click(toggle);
    expect(screen.getByText("Active Bias Correction")).toBeInTheDocument();
  });

  it("header status pill updates with governance toggle", async () => {
    render(<App />);
    const user = userEvent.setup();

    expect(screen.getByText("Protected")).toBeInTheDocument();

    const toggle = screen.getByLabelText("Toggle governance mode");
    await user.click(toggle);
    expect(screen.getByText("Unprotected")).toBeInTheDocument();
  });
});

describe("Applicant Queue Tab", () => {
  it("renders all applicants in the table", () => {
    render(<App />);
    expect(screen.getByText("APP-10291")).toBeInTheDocument();
    expect(screen.getByText("APP-10298")).toBeInTheDocument();
    expect(screen.getByText("Maria Gonzalez")).toBeInTheDocument();
  });

  it("filters by gender", async () => {
    render(<App />);
    const user = userEvent.setup();

    const genderSelect = screen.getByDisplayValue("All Genders");
    await user.selectOptions(genderSelect, "Non-Binary");

    expect(screen.getByText("1 of 8 applicants")).toBeInTheDocument();
    expect(screen.getByText("Taylor Nguyen")).toBeInTheDocument();
  });

  it("filters by search query", async () => {
    render(<App />);
    const user = userEvent.setup();

    const searchInput = screen.getByPlaceholderText("Search by ID or name...");
    await user.type(searchInput, "Chen");

    expect(screen.getByText("1 of 8 applicants")).toBeInTheDocument();
    expect(screen.getByText("James Chen")).toBeInTheDocument();
  });

  it("shows all biased statuses when governance is OFF", async () => {
    render(<App />);
    const user = userEvent.setup();

    const toggle = screen.getByLabelText("Toggle governance mode");
    await user.click(toggle);

    const badges = screen.getAllByText("Biased / Needs Review");
    expect(badges.length).toBe(8);
  });

  it("clicking Audit navigates to audit tab with correct applicant", async () => {
    render(<App />);
    const user = userEvent.setup();

    const auditButtons = screen.getAllByText("Audit");
    await user.click(auditButtons[0]);

    expect(screen.getByText("What-If Simulator")).toBeInTheDocument();
    expect(screen.getByText("SHAP Feature Importance")).toBeInTheDocument();
  });
});

describe("Audit & Override Tab", () => {
  it("renders all sections for selected applicant", async () => {
    render(<App />);
    const user = userEvent.setup();

    await user.click(screen.getByText("Audit & Override"));

    expect(screen.getByText("What-If Simulator")).toBeInTheDocument();
    expect(screen.getByText("Decision Metrics")).toBeInTheDocument();
    expect(screen.getByText("SHAP Feature Importance")).toBeInTheDocument();
    expect(screen.getByText("AI Explanation")).toBeInTheDocument();
    expect(screen.getByText("Action & Audit")).toBeInTheDocument();
  });

  it("shows approve confirmation when button is clicked", async () => {
    render(<App />);
    const user = userEvent.setup();

    await user.click(screen.getByText("Audit & Override"));
    await user.click(screen.getByText("Approve with Override"));

    expect(screen.getByText(/manually approved/)).toBeInTheDocument();
  });

  it("renders Export PDF button", async () => {
    render(<App />);
    const user = userEvent.setup();

    await user.click(screen.getByText("Audit & Override"));
    expect(screen.getByText("Export PDF")).toBeInTheDocument();
  });

  it("can switch applicant via dropdown", async () => {
    render(<App />);
    const user = userEvent.setup();

    await user.click(screen.getByText("Audit & Override"));
    const dropdown = screen.getByDisplayValue(/APP-10291/);
    await user.selectOptions(dropdown, "APP-10294");

    expect(screen.getByText(/Exemplary risk profile/)).toBeInTheDocument();
  });
});

describe("System Metrics Tab", () => {
  it("renders policy engine and drift monitoring", async () => {
    render(<App />);
    const user = userEvent.setup();

    await user.click(screen.getByText("System Metrics & MLOps"));

    expect(screen.getByText("Policy Engine Rules")).toBeInTheDocument();
    expect(screen.getByText("Continuous Drift Monitoring")).toBeInTheDocument();
    expect(screen.getByText("Run Live Simulation")).toBeInTheDocument();
    expect(screen.getByText("Alert History")).toBeInTheDocument();
  });

  it("shows policy JSON with version", async () => {
    render(<App />);
    const user = userEvent.setup();

    await user.click(screen.getByText("System Metrics & MLOps"));
    expect(screen.getByText("v2.4.1")).toBeInTheDocument();
  });

  it("shows KPI cards", async () => {
    render(<App />);
    const user = userEvent.setup();

    await user.click(screen.getByText("System Metrics & MLOps"));
    expect(screen.getByText("Population Stability Index")).toBeInTheDocument();
    expect(screen.getByText("Global Disparate Impact Ratio")).toBeInTheDocument();
  });
});
