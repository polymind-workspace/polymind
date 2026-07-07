import {
  mockMarkets,
  getMarketBySlug,
  toMarketDetail,
  mockLeaderboardInvite,
  mockLeaderboardBet,
  mockLeaderboardTopic,
  mockNotifications,
  mockUserProfile,
  mockUserPositions,
} from "./index"

const delay = () => new Promise<void>((resolve) => setTimeout(resolve, 300))

const jsonResponse = <T>(data: T, status = 200): Response => {
  const body = JSON.stringify(data)
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? "OK" : "Error",
    headers: new Headers({ "Content-Type": "application/json" }),
    json: async () => JSON.parse(body) as T,
    text: async () => body,
    clone: () => jsonResponse(data, status),
    body: null,
    bodyUsed: true,
    redirected: false,
    type: "basic",
    url: "",
    arrayBuffer: async () => new TextEncoder().encode(body).buffer as ArrayBuffer,
    blob: async () => new Blob([body], { type: "application/json" }),
    formData: async () => {
      throw new Error("formData not supported in mock response")
    },
    bytes: async () => new Uint8Array(new TextEncoder().encode(body)),
  } as Response
}

const notFound = (message: string): Response =>
  jsonResponse({ ret: 404, msg: message, data: null }, 404)

const parseQuery = (path: string): Record<string, string> => {
  const query: Record<string, string> = {}
  const idx = path.indexOf("?")
  if (idx === -1) return query
  const params = new URLSearchParams(path.slice(idx + 1))
  params.forEach((value, key) => {
    query[key] = value
  })
  return query
}

const stripQuery = (path: string): string => {
  const idx = path.indexOf("?")
  return idx === -1 ? path : path.slice(0, idx)
}

const filterMarkets = (query: Record<string, string>) => {
  let list = [...mockMarkets]

  const category = query.category ?? query.tab
  if (category && category !== "all") {
    if (category === "live") {
      list = list.filter((m) => m.status === "open" && new Date(m.endTime) > new Date())
    } else if (category === "trending") {
      list = list.filter((m) => m.category === "trending" || m.volume > 1_000_000)
    } else {
      list = list.filter((m) => m.category === category)
    }
  }

  const status = query.status
  if (status) {
    list = list.filter((m) => m.status === status)
  }

  const source = query.source
  if (source) {
    list = list.filter((m) => m.source === source)
  }

  const search = query.search ?? query.q
  if (search) {
    const term = search.toLowerCase()
    list = list.filter(
      (m) =>
        m.title.toLowerCase().includes(term) ||
        m.description.toLowerCase().includes(term) ||
        m.tags?.some((tag) => tag.toLowerCase().includes(term)),
    )
  }

  const sort = query.sort
  if (sort === "volume") {
    list.sort((a, b) => b.volume - a.volume)
  } else if (sort === "newest") {
    list.sort((a, b) => new Date(b.endTime).getTime() - new Date(a.endTime).getTime())
  } else if (sort === "ending") {
    list.sort((a, b) => new Date(a.endTime).getTime() - new Date(b.endTime).getTime())
  } else {
    list.sort((a, b) => {
      const sourceOrder = { official: 0, champion: 1, admin: 2, user: 3, undefined: 4 }
      const aOrder = sourceOrder[a.source ?? "undefined"]
      const bOrder = sourceOrder[b.source ?? "undefined"]
      if (aOrder !== bOrder) return aOrder - bOrder
      return b.volume - a.volume
    })
  }

  const page = Math.max(1, parseInt(query.page ?? "1", 10))
  const limit = Math.min(100, Math.max(1, parseInt(query.limit ?? "20", 10)))
  const start = (page - 1) * limit
  const paginated = list.slice(start, start + limit)

  return {
    ret: 200,
    msg: "ok",
    data: {
      items: paginated,
      total: list.length,
      page,
      limit,
      hasMore: start + limit < list.length,
    },
  }
}

export async function mockHandler(path: string, options?: RequestInit): Promise<Response> {
  await delay()

  const cleanPath = stripQuery(path)
  const query = parseQuery(path)
  const method = options?.method?.toUpperCase() ?? "GET"

  if (cleanPath === "/health") {
    return jsonResponse({ status: "ok" })
  }

  if (cleanPath === "/markets") {
    return jsonResponse(filterMarkets(query))
  }

  const marketMatch = cleanPath.match(/^\/markets\/([^/]+)$/)
  if (marketMatch) {
    const slug = marketMatch[1]
    const market = getMarketBySlug(slug)
    if (!market) return notFound(`Market not found: ${slug}`)
    return jsonResponse({ ret: 200, msg: "ok", data: toMarketDetail(market) })
  }

  const leaderboardMatch = cleanPath.match(/^\/leaderboard\/([^/]+)$/)
  if (leaderboardMatch) {
    const type = leaderboardMatch[1]
    const boards: Record<string, { ret: number; msg: string; data: unknown }> = {
      invite: { ret: 200, msg: "ok", data: mockLeaderboardInvite },
      bet: { ret: 200, msg: "ok", data: mockLeaderboardBet },
      topic: { ret: 200, msg: "ok", data: mockLeaderboardTopic },
    }
    const board = boards[type]
    if (!board) return notFound(`Leaderboard type not found: ${type}`)
    return jsonResponse(board)
  }

  if (cleanPath === "/notifications") {
    if (method === "POST" || method === "PUT") {
      return jsonResponse({ ret: 200, msg: "ok", data: { updated: true } })
    }
    return jsonResponse({ ret: 200, msg: "ok", data: mockNotifications })
  }

  if (cleanPath === "/profile") {
    return jsonResponse({ ret: 200, msg: "ok", data: mockUserProfile })
  }

  if (cleanPath === "/predictions") {
    return jsonResponse({ ret: 200, msg: "ok", data: mockUserPositions })
  }

  return notFound(`Mock route not found: ${cleanPath}`)
}
