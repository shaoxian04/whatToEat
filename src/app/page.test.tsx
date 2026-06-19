import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import Home from "@/app/page";

describe("Home", () => {
  it("renders the three entry modes with correct links", () => {
    render(<Home />);
    expect(screen.getByRole("link", { name: /surprise me/i })).toHaveAttribute("href", "/surprise");
    expect(screen.getByRole("link", { name: /browse/i })).toHaveAttribute("href", "/browse");
    expect(screen.getByRole("link", { name: /group vote/i })).toHaveAttribute("href", "/vote");
  });
});
