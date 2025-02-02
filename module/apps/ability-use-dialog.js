/**
 * A specialized Dialog subclass for ability usage
 * @type {Dialog}
 */
export default class AbilityUseDialog extends Dialog {
  constructor(item, dialogData={}, options={}) {
    super(dialogData, options);
    this.options.classes = ["dnd4eBeta", "dialog"];

    /**
     * Store a reference to the Item entity being used
     * @type {Item4e}
     */
    this.item = item;
  }

  /* -------------------------------------------- */
  /*  Rendering                                   */
  /* -------------------------------------------- */

  /**
   * A constructor function which displays the Spell Cast Dialog app for a given Actor and Item.
   * Returns a Promise which resolves to the dialog FormData once the workflow has been completed.
   * @param {Item4e} item
   * @return {Promise}
   */
  static async create(item) {
    if ( !item.isOwned ) throw new Error("You cannot display an ability usage dialog for an unowned item");

    // Prepare data
    const actorData = item.actor.data.data;
    const itemData = item.data.data;
    const uses = itemData.uses || {};
    const quantity = itemData.quantity || 0;
    const recharge = itemData.recharge || {};
    const recharges = !!recharge.value;

    // Prepare dialog form data
    const data = {
      item: item.data,
      title: game.i18n.format("DND4EBETA.AbilityUseHint", item.data),
      note: this._getAbilityUseNote(item.data, uses, recharge),
      hasLimitedUses: uses.max || recharges,
      canUse: recharges ? recharge.charged : (quantity > 0 && !uses.value) || uses.value > 0,
      hasPlaceableTemplate: game.user.can("TEMPLATE_CREATE") && item.hasAreaTarget,
      errors: []
    };
    if ( item.data.type === "spell" ) this._getSpellData(actorData, itemData, data);

    // Render the ability usage template
    const html = await renderTemplate("systems/dnd4e/templates/apps/ability-use.html", data);

    // Create the Dialog and return as a Promise
    const icon = data.hasSpellSlots ? "fa-magic" : "fa-fist-raised";
    // const label = game.i18n.localize("DND4EBETA.AbilityUse" + (data.hasSpellSlots ? "Cast" : "Use"));
    const label = game.i18n.localize("DND4EBETA.AbilityUseItem");
    return new Promise((resolve) => {
      const dlg = new this(item, {
        title: `${item.name}: Usage Configuration`,
        content: html,
        buttons: {
          use: {
            icon: `<i class="fas ${icon}"></i>`,
            label: label,
            callback: html => resolve(new FormData(html[0].querySelector("form")))
          }
        },
        default: "use",
        close: () => resolve(null)
      });
      dlg.render(true);
    });
  }

  /* -------------------------------------------- */
  /*  Helpers                                     */
  /* -------------------------------------------- */

  /**
   * Get dialog data related to limited spell slots
   * @private
   */
  static _getSpellData(actorData, itemData, data) {

    // Determine whether the spell may be up-cast
    const lvl = itemData.level;
    const canUpcast = (lvl > 0) && CONFIG.DND4EBETA.spellUpcastModes.includes(itemData.preparation.mode);

    // Determine the levels which are feasible
    let lmax = 0;
    const spellLevels = Array.fromRange(10).reduce((arr, i) => {
      if ( i < lvl ) return arr;
      const label = CONFIG.DND4EBETA.spellLevels[i];
      const l = actorData.spells["spell"+i] || {max: 0, override: null};
      let max = parseInt(l.override || l.max || 0);
      let slots = Math.clamped(parseInt(l.value || 0), 0, max);
      if ( max > 0 ) lmax = i;
      arr.push({
        level: i,
        label: i > 0 ? game.i18n.format('DND4EBETA.SpellLevelSlot', {level: label, n: slots}) : label,
        canCast: canUpcast && (max > 0),
        hasSlots: slots > 0
      });
      return arr;
    }, []).filter(sl => sl.level <= lmax);

    // If this character has pact slots, present them as an option for casting the spell.
    const pact = actorData.spells.pact;
    if (pact.level >= lvl) {
      spellLevels.push({
        level: 'pact',
        label: `${game.i18n.format('DND4EBETA.SpellLevelPact', {level: pact.level, n: pact.value})}`,
        canCast: canUpcast,
        hasSlots: pact.value > 0
      });
    }
    const canCast = spellLevels.some(l => l.hasSlots);

    // Return merged data
    data = mergeObject(data, { hasSpellSlots: true, canUpcast, spellLevels });
    if ( !canCast ) data.errors.push("DND4EBETA.SpellCastNoSlots");
  }

  /* -------------------------------------------- */

  /**
   * Get the ability usage note that is displayed
   * @private
   */
  static _getAbilityUseNote(item, uses, recharge) {

    // Zero quantity
    const quantity = item.data.quantity;
    if ( quantity <= 0 ) return game.i18n.localize("DND4EBETA.AbilityUseUnavailableHint");

    // Abilities which use Recharge
    if ( !!recharge.value ) {
      return game.i18n.format(recharge.charged ? "DND4EBETA.AbilityUseChargedHint" : "DND4EBETA.AbilityUseRechargeHint", {
        type: item.type,
      })
    }

    // Does not use any resource
    if ( !uses.per || !uses.max ) return "";

    // Consumables
    if ( item.type === "consumable" ) {
      let str = "DND4EBETA.AbilityUseNormalHint";
      if ( uses.value > 1 ) str = "DND4EBETA.AbilityUseConsumableChargeHint";
      else if ( item.data.quantity === 1 && uses.autoDestroy ) str = "DND4EBETA.AbilityUseConsumableDestroyHint";
      else if ( item.data.quantity > 1 ) str = "DND4EBETA.AbilityUseConsumableQuantityHint";
      return game.i18n.format(str, {
        type: item.data.consumableType,
        value: uses.value,
        quantity: item.data.quantity,
      });
    }

    // Other Items
    else {
      return game.i18n.format("DND4EBETA.AbilityUseNormalHint", {
        type: item.type,
        value: uses.value,
        max: uses.max,
        per: CONFIG.DND4EBETA.limitedUsePeriods[uses.per]
      });
    }
  }

  /* -------------------------------------------- */

  static _handleSubmit(formData, item) {

  }
}
