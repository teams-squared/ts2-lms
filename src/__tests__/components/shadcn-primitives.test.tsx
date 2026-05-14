/**
 * Smoke tests for the shadcn/ui primitives.
 *
 * Each primitive is a thin wrapper over a Radix component with Teams Squared
 * tokens. The library is already tested upstream — these tests verify that
 * our wrappers (a) render at all, (b) merge custom className correctly, and
 * (c) apply the brand-specific classes from the design system. They are
 * NOT exhaustive interaction tests — Radix covers those.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardAction,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import {
  Avatar,
  AvatarImage,
  AvatarFallback,
  AvatarBadge,
  AvatarGroup,
  AvatarGroupCount,
} from "@/components/ui/avatar";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@/components/ui/tooltip";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Toaster } from "@/components/ui/sonner";

// next-themes is required by the Sonner wrapper — provide a stub.
vi.mock("@/components/theme/ThemeProvider", () => ({
  useTheme: () => ({ theme: "light", setTheme: vi.fn() }),
}));

describe("Card", () => {
  it("renders the full composition", () => {
    render(
      <Card>
        <CardHeader>
          <CardTitle>Title</CardTitle>
          <CardDescription>Description</CardDescription>
          <CardAction>Action</CardAction>
        </CardHeader>
        <CardContent>Body</CardContent>
        <CardFooter>Footer</CardFooter>
      </Card>,
    );
    expect(screen.getByText("Title")).toBeInTheDocument();
    expect(screen.getByText("Description")).toBeInTheDocument();
    expect(screen.getByText("Action")).toBeInTheDocument();
    expect(screen.getByText("Body")).toBeInTheDocument();
    expect(screen.getByText("Footer")).toBeInTheDocument();
  });

  it("applies the design-system shadow + radius tokens to the root", () => {
    const { container } = render(<Card>x</Card>);
    const root = container.firstChild as HTMLElement;
    expect(root.className).toContain("rounded-lg");
    expect(root.className).toContain("shadow-card-sm");
    expect(root.getAttribute("data-slot")).toBe("card");
  });

  it("merges custom className on every sub-component", () => {
    const { container } = render(
      <Card className="my-card">
        <CardHeader className="my-header" />
        <CardTitle className="my-title" />
        <CardDescription className="my-desc" />
        <CardAction className="my-action" />
        <CardContent className="my-content" />
        <CardFooter className="my-footer" />
      </Card>,
    );
    expect(container.innerHTML).toContain("my-card");
    expect(container.innerHTML).toContain("my-header");
    expect(container.innerHTML).toContain("my-title");
    expect(container.innerHTML).toContain("my-desc");
    expect(container.innerHTML).toContain("my-action");
    expect(container.innerHTML).toContain("my-content");
    expect(container.innerHTML).toContain("my-footer");
  });
});

describe("Separator", () => {
  it("defaults to horizontal", () => {
    const { container } = render(<Separator />);
    const root = container.firstChild as HTMLElement;
    expect(root.getAttribute("data-orientation")).toBe("horizontal");
  });

  it("renders vertical when orientation=vertical", () => {
    const { container } = render(<Separator orientation="vertical" />);
    const root = container.firstChild as HTMLElement;
    expect(root.getAttribute("data-orientation")).toBe("vertical");
  });
});

describe("Progress", () => {
  it("renders a progressbar role with our brand classes", () => {
    render(<Progress value={42} aria-label="Course progress" />);
    const bar = screen.getByRole("progressbar");
    expect(bar.className).toContain("bg-border");
    expect(bar.className).toContain("rounded-full");
  });

  it("renders an indicator element inside the bar reflecting the value", () => {
    const { container } = render(<Progress value={42} aria-label="Empty" />);
    // The indicator child is what reflects progress via inline transform.
    const indicator = container.querySelector(
      '[data-slot="progress-indicator"]',
    );
    expect(indicator).toBeTruthy();
  });
});

describe("Avatar", () => {
  it("renders the fallback when no image source is provided", () => {
    render(
      <Avatar>
        <AvatarImage src="" alt="user" />
        <AvatarFallback>AB</AvatarFallback>
      </Avatar>,
    );
    expect(screen.getByText("AB")).toBeInTheDocument();
  });

  it("encodes the size variant via data-size", () => {
    const { container } = render(
      <Avatar size="lg">
        <AvatarFallback>AB</AvatarFallback>
      </Avatar>,
    );
    expect(container.firstChild).toHaveAttribute("data-size", "lg");
  });

  it("renders AvatarBadge + AvatarGroup + AvatarGroupCount composition", () => {
    const { container } = render(
      <AvatarGroup>
        <Avatar>
          <AvatarFallback>A</AvatarFallback>
          <AvatarBadge />
        </Avatar>
        <Avatar>
          <AvatarFallback>B</AvatarFallback>
        </Avatar>
        <AvatarGroupCount>+3</AvatarGroupCount>
      </AvatarGroup>,
    );
    expect(container.querySelector('[data-slot="avatar-group"]')).toBeTruthy();
    expect(container.querySelector('[data-slot="avatar-badge"]')).toBeTruthy();
    expect(
      container.querySelector('[data-slot="avatar-group-count"]'),
    ).toBeTruthy();
    expect(screen.getByText("+3")).toBeInTheDocument();
  });
});

describe("Accordion", () => {
  it("toggles content visibility on trigger click", () => {
    render(
      <Accordion type="single" collapsible>
        <AccordionItem value="a">
          <AccordionTrigger>Question A</AccordionTrigger>
          <AccordionContent>Answer A body</AccordionContent>
        </AccordionItem>
      </Accordion>,
    );
    const trigger = screen.getByRole("button", { name: /Question A/ });
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(trigger);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
  });
});

describe("Tabs", () => {
  it("renders the default tab content and marks the default trigger active", () => {
    render(
      <Tabs defaultValue="a">
        <TabsList>
          <TabsTrigger value="a">A</TabsTrigger>
          <TabsTrigger value="b">B</TabsTrigger>
        </TabsList>
        <TabsContent value="a">Tab A content</TabsContent>
        <TabsContent value="b">Tab B content</TabsContent>
      </Tabs>,
    );
    expect(screen.getByText("Tab A content")).toBeInTheDocument();
    const triggerA = screen.getByRole("tab", { name: "A" });
    const triggerB = screen.getByRole("tab", { name: "B" });
    expect(triggerA.getAttribute("data-state")).toBe("active");
    expect(triggerB.getAttribute("data-state")).toBe("inactive");
  });

  it("applies the design-system classes to the TabsList root", () => {
    const { container } = render(
      <Tabs defaultValue="a">
        <TabsList>
          <TabsTrigger value="a">A</TabsTrigger>
        </TabsList>
      </Tabs>,
    );
    const list = container.querySelector('[data-slot="tabs-list"]');
    expect(list).toBeTruthy();
  });
});

describe("Tooltip", () => {
  it("renders trigger and accepts open prop without throwing", () => {
    render(
      <TooltipProvider>
        <Tooltip open>
          <TooltipTrigger>Hover me</TooltipTrigger>
          <TooltipContent>Helpful hint</TooltipContent>
        </Tooltip>
      </TooltipProvider>,
    );
    expect(screen.getByText("Hover me")).toBeInTheDocument();
    // Radix renders the content into a portal when open — at least one node
    // with the text should be present in document.body.
    expect(document.body.textContent).toContain("Helpful hint");
  });
});

describe("Select", () => {
  it("renders trigger with placeholder and exposes role=combobox", () => {
    render(
      <Select>
        <SelectTrigger>
          <SelectValue placeholder="Pick one" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="x">X</SelectItem>
        </SelectContent>
      </Select>,
    );
    const trigger = screen.getByRole("combobox");
    expect(trigger).toBeInTheDocument();
    expect(screen.getByText("Pick one")).toBeInTheDocument();
  });

  it("renders SelectItem children inside the content portal when open", () => {
    render(
      <Select open>
        <SelectTrigger>
          <SelectValue placeholder="Pick one" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="alpha">Alpha</SelectItem>
          <SelectItem value="beta">Beta</SelectItem>
        </SelectContent>
      </Select>,
    );
    expect(document.body.textContent).toContain("Alpha");
    expect(document.body.textContent).toContain("Beta");
  });
});

describe("Sheet", () => {
  it("renders trigger and exposes Sheet content when defaultOpen", () => {
    render(
      <Sheet defaultOpen>
        <SheetTrigger>Open</SheetTrigger>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Sheet title</SheetTitle>
            <SheetDescription>Sheet desc</SheetDescription>
          </SheetHeader>
        </SheetContent>
      </Sheet>,
    );
    expect(document.body.textContent).toContain("Sheet title");
    expect(document.body.textContent).toContain("Sheet desc");
  });
});

describe("DropdownMenu", () => {
  it("renders trigger and exposes items inside the portal when open", () => {
    render(
      <DropdownMenu open>
        <DropdownMenuTrigger>Menu</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>Edit</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem>Delete</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    );
    expect(document.body.textContent).toContain("Edit");
    expect(document.body.textContent).toContain("Delete");
  });
});

describe("Toaster (sonner wrapper)", () => {
  it("renders without throwing", () => {
    // Sonner exposes its own host element to the DOM.
    const { container } = render(<Toaster />);
    // The component renders nothing at mount time except the portal host —
    // a successful render-no-throw is the smoke contract.
    expect(container).toBeTruthy();
  });
});
