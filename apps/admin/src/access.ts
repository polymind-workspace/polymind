// Route-level access gating isn't used — admin auth lives at the wallet +
// FastAPI layer. Keep the file so umi's access plugin stays happy.
export default function access() {
  return {};
}
