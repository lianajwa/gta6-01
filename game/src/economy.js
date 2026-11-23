// Economy: cash, respect ranks, and the five shops — gun shop, garage
// upgrades, spray shop (clears wanted), clinic and safehouse. Prices respect
// the district discount where the shop stands.
export function createEconomy() {
  const PRICES = {
    pistol: 500, ammo: 50,
    turbo: 800, armor: 600, grip: 400,
    spray: 200, heal: 150,
  };
  return {
    prices: PRICES,
    price(G, key, x, z) {
      const disc = G.districts.discount(x, z);
      return Math.round(PRICES[key] * (1 - disc));
    },
    buy(G, key) {
      const s = G.state;
      const shop = G.nearestShop;
      const p = this.price(G, key, shop ? shop.x : s.player.x, shop ? shop.z : s.player.z);
      if (s.cash < p) { G.hud.flash(`NEED $${p} — YOU HAVE $${s.cash}`); return false; }
      s.cash -= p;
      switch (key) {
        case 'pistol': s.pistol = true; s.ammo += 24; break;
        case 'ammo': s.ammo += 24; break;
        case 'turbo': s.upgrades.turbo = true; break;
        case 'armor': s.upgrades.armor = true; s.armor = 100; break;
        case 'grip': s.upgrades.grip = true; break;
        case 'spray': s.wanted = 0; G.police.clear(); break;
        case 'heal': s.health = 100; s.armor = Math.max(s.armor, 50); break;
        default: return false;
      }
      G.audio.beep(740, 0.1);
      G.hud.flash(`${key.toUpperCase()} BOUGHT — $${p}`);
      G.save();
      return true;
    },
    // Street cash: pedestrians sometimes drop cash when scared off.
    streetCash(G, x, z) {
      G.combat.spawnPickup(x, z, 'cash');
    },
  };
}
