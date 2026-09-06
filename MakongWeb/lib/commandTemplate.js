// Turns "crates give {player} common {quantity}" into a real console command.
// Used to build the text shown for manual copy-paste in Telegram, and reused
// as-is for commands sent automatically through the MakongStore plugin bridge
// (lib/pluginBridge.js) once a server is connected.
function buildCommand(template, { player, itemName, orderId, quantity }) {
  return String(template)
    .replace(/\{player\}/g, player)
    .replace(/\{item\}/g, itemName)
    .replace(/\{order\}/g, orderId)
    .replace(/\{quantity\}/g, quantity != null ? String(quantity) : "1")
    .replace(/^\//, ""); // sent to a console without the leading slash
}

module.exports = { buildCommand };
