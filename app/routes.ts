import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("coordi/:id", "routes/coordi-detail.tsx"),
  route("like/:id", "routes/like.tsx"),
  route("liked", "routes/liked.tsx"),
  route("api/item-suggestions", "routes/item-suggestions.tsx"),
  route("api/item-wearer-counts", "routes/api.item-wearer-counts.tsx"),
  route("api/liked-coordi", "routes/api.liked-coordi.tsx"),
  route("api/cron/crawl", "routes/api.cron.crawl.tsx"),
] satisfies RouteConfig;
