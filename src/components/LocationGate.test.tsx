import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LocationGate } from "@/components/LocationGate";

function denyGeolocation() {
  Object.defineProperty(navigator, "geolocation", {
    configurable: true,
    value: { getCurrentPosition: (_ok: unknown, fail: () => void) => fail() },
  });
}

afterEach(() => {
  // jsdom has no geolocation by default; drop whatever a test installed.
  delete (navigator as { geolocation?: unknown }).geolocation;
});

describe("LocationGate", () => {
  it("offers an area search when location is denied, then renders with the found area", async () => {
    denyGeolocation();
    const searchArea = vi.fn().mockResolvedValue({ lat: 3.1, lng: 101.7, label: "Bukit Bintang" });
    render(
      <LocationGate searchArea={searchArea}>
        {({ coords, label }) => <p>{`${label} @ ${coords.lat},${coords.lng}`}</p>}
      </LocationGate>,
    );
    expect(await screen.findByText(/couldn't get your location/i)).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText(/area or address/i), "bukit bintang");
    await userEvent.click(screen.getByRole("button", { name: /find food here/i }));
    expect(await screen.findByText("Bukit Bintang @ 3.1,101.7")).toBeInTheDocument();
    expect(searchArea).toHaveBeenCalledWith("bukit bintang");
  });

  it("shows the search error when the area isn't found", async () => {
    denyGeolocation();
    const searchArea = vi.fn().mockRejectedValue(new Error("We couldn't find that place."));
    render(<LocationGate searchArea={searchArea}>{() => <p>ready</p>}</LocationGate>);
    await userEvent.type(await screen.findByLabelText(/area or address/i), "nowhere");
    await userEvent.click(screen.getByRole("button", { name: /find food here/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent("We couldn't find that place.");
    expect(screen.queryByText("ready")).toBeNull();
  });

  it("renders children with the device location when allowed", async () => {
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: {
        getCurrentPosition: (ok: (p: { coords: { latitude: number; longitude: number } }) => void) =>
          ok({ coords: { latitude: 1, longitude: 2 } }),
      },
    });
    render(<LocationGate>{({ label, coords }) => <p>{`${label} ${coords.lat},${coords.lng}`}</p>}</LocationGate>);
    expect(await screen.findByText("Your location 1,2")).toBeInTheDocument();
  });
});
