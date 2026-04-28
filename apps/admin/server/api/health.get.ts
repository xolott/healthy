export default defineEventHandler(() => {
  return {
    status: "ok",
    service: "healthy-admin-panel",
    time: new Date().toISOString(),
  };
});
