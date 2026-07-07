import { describe, expect, it } from "vitest"
import { formatNumber } from "./date"

describe("formatNumber", () => {
  it("formats thousands", () => {
    expect(formatNumber(1500)).toBe("1.5K")
  })
  it("formats millions", () => {
    expect(formatNumber(2_500_000)).toBe("2.5M")
  })
  it("returns locale string for small numbers", () => {
    expect(formatNumber(999)).toBe("999")
  })
})
