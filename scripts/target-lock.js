console.log("target-lock | Hello World!");

async function applyActorDamage(
    roll,
    tokenID,
    multiplier,
    attribute = 'attributes.hp',
    modifier = 0,
    shieldID = {}
) {
    const tokens = canvas.tokens.ownedTokens.filter((token) => token.data._id === tokenID && token.actor);
    if (tokens.length === 0) {
        ui.notifications.error(game.i18n.localize('PF2E.UI.errorTargetToken'));
        return false;
    }

    const value = Math.floor(parseFloat(roll.find('.dice-total').text()) * multiplier) + modifier;
    const messageSender = roll.find('.message-sender').text();
    const flavorText = roll.find('.flavor-text').text();
    for (const token of tokens) {
        const actor = token.actor;
        const shield =
            attribute === 'attributes.shield'
                ? shieldID
                    ? actor.itemTypes.armor.find((armor) => armor.isShield && armor.id === shieldID) ?? null
                    : actor.heldShield
                : null;
        if (attribute === 'attributes.shield' && shield?.isBroken) {
            const warnings = LocalizePF2e.translations.PF2E.Actions.RaiseAShield;
            ui.notifications.warn(
                game.i18n.format(warnings.ShieldIsBroken, { actor: token.name, shield: shield.name }),
            );
        }

        const shieldFlavor =
            attribute === 'attributes.shield' && shield?.isBroken === false
                ? game.i18n.format('PF2E.UI.applyDamage.shieldActive', { shield: shield.name })
                : game.i18n.localize('PF2E.UI.applyDamage.shieldInActive');
        const shieldDamage =
            attribute === 'attributes.shield' && shield?.isBroken === false && value > 0
                ? `(${Math.max(0, value - shield.hardness)})`
                : '';
        const appliedResult =
            value > 0
                ? game.i18n.localize('PF2E.UI.applyDamage.damaged') + value + shieldDamage
                : game.i18n.localize('PF2E.UI.applyDamage.healed') + value * -1;
        const modifiedByGM = modifier !== 0 ? `Modified by GM: ${modifier < 0 ? '-' : '+'}${modifier}` : '';
        const by = game.i18n.localize('PF2E.UI.applyDamage.by');
        const hitpoints = game.i18n.localize('PF2E.HitPointsHeader').toLowerCase();
        // Temporary hard code the message until new rendering can be figured out
//         const message = await renderTemplate('systems/pf2e/templates/chat/damage/result-message.html', {
//             flavorText,
//             by,
//             messageSender,
//             modifiedByGM,
//             actor: token.name,
//             shieldFlavor,
//             appliedResult,
//             hitpoints,
//         });
        const message = token.name + " was " + appliedResult + " " + hitpoints;
        actor.modifyTokenAttribute(attribute, value * -1, true, true, shield).then(() => {
            const data = {
                user: game.user._id,
                speaker: { alias: token.name },
                content: message,
                type: CONST.CHAT_MESSAGE_TYPES.EMOTE,
            };
            if (game.settings.get('pf2e', 'metagame.secretDamage') && !token?.actor?.hasPlayerOwner) {
                data.whisper = ChatMessage.getWhisperRecipients('GM');
            }
            ChatMessage.create(data);
        });
    }
    return true;
};

function TLshiftModifyDamage(html, tokenID, multiplier, attributePassed = 'attributes.hp') {
    new Dialog({
        title: game.i18n.localize('PF2E.UI.shiftModifyDamageTitle'),
        content: `<form>
                <div class="form-group">
                    <label>${game.i18n.localize('PF2E.UI.shiftModifyDamageLabel')}</label>
                    <input type="number" name="modifier" value="" placeholder="0">
                </div>
                </form>
                <script type="text/javascript">
                $(function () {
                    $(".form-group input").focus();
                });
                </script>`,
        buttons: {
            ok: {
                label: 'Ok',
                callback: async (dialogHtml) => {
                    let modifier = parseFloat(dialogHtml.find('[name="modifier"]').val());
                    if (Number.isNaN(modifier)) {
                        modifier = 0;
                    }
                    if (modifier !== undefined) {
                        await applyActorDamage(html, tokenID, multiplier, attribute, modifier);
                    }
                },
            },
        },
        default: 'ok',
        close: () => {},
    }).render(true);
};

function applyTokenDamage(html, tokenID, multiplier, promptModifier = false) {
    let attribute = 'attributes.hp';
    const $button = html.find('button.shield-block');
    if (CONFIG.PF2E.chatDamageButtonShieldToggle && multiplier > 0) {
        attribute = 'attributes.shield';
        $button.removeClass('shield-activated');
        CONFIG.PF2E.chatDamageButtonShieldToggle = false;
    }
    const shieldID = $button.attr('data-shield-id') ?? undefined;

    if (promptModifier) {
        TLshiftModifyDamage(html, tokenID, multiplier, attribute);
    } else {
        applyActorDamage(html, tokenID, multiplier, attribute, 0, { shieldID: shieldID });
    }
};


Hooks.on("renderChatMessage", async (message, html, data) => {
    //if chat message has damage roll
    var _a;
    const damageRoll = message.getFlag("pf2e", "damageRoll")
    , fromRollTable = void 0 !== message.getFlag("core", "RollTable")
    , isRoll = damageRoll || message.isRoll
    , isD20 = isRoll && message.roll && 20 === (null === (_a = message.roll.dice[0]) || void 0 === _a ? void 0 : _a.faces) || !1;
    if (!isRoll || isD20 || fromRollTable)
        return;
    
    // const $targets = $(await renderTemplate("modules/target-lock/templates/target-list.html", Array.from(data.author.targets)));
    // html.append($targets);

    if (Array.from(data.author.targets).length === 0) {
        return;
    }     
    // else {
    //     html.append("<hr class='target-lock'/><span class='target-lock-title'>Targets:</span>");
    // }
    
    
    //TODO --figure out how wrap everything in a div
    html.append("<div class='target-lock-chat-window'><hr class='target-lock'/></div>")

    //foreach target
    for (const target of Array.from(data.author.targets)) { //cant use foreach due to async
        const innerHTML = $(await renderTemplate("systems/pf2e/templates/chat/damage/buttons.html", {}));
        const full = innerHTML.find('button.full-damage');
        const half = innerHTML.find('button.half-damage');
        const double = innerHTML.find('button.double-damage');
        const heal = innerHTML.find('button.heal-damage');

        full.on('click', (event) => {
            console.log("target-lock | Full Damage");
            applyTokenDamage(html, target.data._id, 1, event.shiftKey);
            //applyDamage(innerHTML, 1, event.shiftKey);
        });
        full.removeClass('full-damage');

        half.on('click', (event) => {
            console.log("target-lock | Half Damage");
            applyTokenDamage(html, target.data._id, 0.5, event.shiftKey);
            //applyDamage(innerHTML, 1, event.shiftKey);
        });
        half.removeClass('half-damage');

        double.on('click', (event) => {
            console.log("target-lock | Double Damage");
            applyTokenDamage(html, target.data._id, 2, event.shiftKey);
            //applyDamage(innerHTML, 1, event.shiftKey);
        });
        double.removeClass('double-damage');

        heal.on('click', (event) => {
            console.log("target-lock | Heal Damage");
            applyTokenDamage(html, target.data._id, -1, event.shiftKey);
            //applyDamage(innerHTML, 1, event.shiftKey);
        });
        heal.removeClass('heal-damage');

        html.find('div.target-lock-chat-window').append("<span class='target-lock-target-name flavor-text'><b>Target: " + target.data.name +  "</b></span>");
        html.find('div.target-lock-chat-window').append(innerHTML);   
    };
    html.find('div.target-lock-chat-window').append("<hr class='target-lock'/>");
    //html.find('li > div.chat-damage-buttons').prepend("<span class='target-lock-target-name flavor-text'><b>Selected Tokens:</b></span>");
});
