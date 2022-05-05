
Hooks.on("renderChatMessage", async (message, html, data) => {
    
    //if chat message is not damage roll, return
    if (!message.isDamageRoll){
        return;
    }
    console.info("target-lock | renderChatMessage");
    if (Array.from(data.author.targets).length === 0) {
        console.warn("target-lock | No targets");
        return;
    } 

    html.append("<div class='target-lock-chat-window'><hr class='target-lock'/></div>")

    //for each targetted token
    //let targets = await Promise.all(Array.from(data.author.targets).map( async (target) => {
    for (const target of Array.from(data.author.targets)) {

        let tokenID = target.data._id

        //render template
        const innerHtml = $(await renderTemplate("modules/target-lock/templates/buttons.html", {
                showTripleDamage: game.settings.get("pf2e", "critFumbleButtons"),
            }));
            
        // #region get elements to target
        const full = innerHtml.find("button.full-damage");
        const half = innerHtml.find("button.half-damage");
        const double = innerHtml.find("button.double-damage");
        const triple = innerHtml.find("button.triple-damage");
        const heal = innerHtml.find("button.heal-damage");
        const contentSelector = `li.chat-message[data-message-id="${message.id}"] div.hover-content`;
        const $shield = innerHtml
            .find("button.shield-block")
            .attr({ "data-tooltip-content": contentSelector })
            .tooltipster({
            animation: "fade",
            trigger: "click",
            arrow: false,
            contentAsHtml: true,
            interactive: true,
            side: ["top"],
            theme: "crb-hover",
        });
        $shield.tooltipster("disable");
        innerHtml.find("button.shield-block").attr({ title: "LocalizePF2e.translations.PF2E.DamageButton.ShieldBlock" });
        
        //Add click events to apply damage
        full.on("click", (event) => {
            applyDamage(message, tokenID, 1, 0, event.shiftKey);
        });
        full.removeClass('full-damage');

        half.on("click", (event) => {
            applyDamage(message, tokenID, 0.5, 0, event.shiftKey);
        });
        half.removeClass('half-damage');

        double.on("click", (event) => {
            applyDamage(message, tokenID, 2, 0, event.shiftKey);
        });
        double.removeClass('full-damage');

        // triple === null || triple === void 0 ? void 0 : triple.on("click", (event) => {
        //     applyDamage(message, tokenID, 3, 0, event.shiftKey);
        // });
        // triple.removeClass

        heal.on("click", (event) => {
            applyDamage(message, tokenID, -1, 0, event.shiftKey);
        });
        heal.removeClass('heal-button')
        
        $shield.on("click", async (event) => {
            console.info(`Toggle Shield for TokenID: ${tokenID}`);
            const tokens = canvas.tokens.ownedTokens.filter((token) => token.data._id === tokenID && token.actor);
            if (tokens.length === 0) {
                const errorMsg = "LocalizePF2e.translations.PF2E.UI.errorTargetToken";
                ui.notifications.error(errorMsg);
                event.stopPropagation();
                return;
            }
            // If the actor is wielding more than one shield, have the user pick which shield to block for blocking.
            const actor = tokens[0].actor;
            const heldShields = actor.itemTypes.armor.filter((armor) => armor.isEquipped && armor.isShield);
            const nonBrokenShields = heldShields.filter((shield) => !shield.isBroken);
            const multipleShields = tokens.length === 1 && nonBrokenShields.length > 1;
            const shieldActivated = $shield.hasClass("shield-activated");
            if (multipleShields && !shieldActivated) {
                $shield.tooltipster("enable");
                // Populate the list with the shield options
                const $list = $buttons.find("ul.shield-options");
                $list.children("li").remove();
                const $template = $list.children("template");
                for (const shield of nonBrokenShields) {
                    const $listItem = $($template.innerHtml());
                    $listItem.children("input.data").val(shield.id);
                    $listItem.children("span.label").text(shield.name);
                    const hardnessLabel = "LocalizePF2e.translations.PF2E.ShieldHardnessLabel";
                    $listItem.children("span.tag").text(`${hardnessLabel}: ${shield.hardness}`);
                    $list.append($listItem);
                }
                $list.find("li input").on("change", (event) => {
                    const $input = $(event.currentTarget);
                    $shield.attr({ "data-shield-id": $input.val() });
                    $shield.tooltipster("close").tooltipster("disable");
                    $shield.addClass("shield-activated");
                    CONFIG.PF2E.chatDamageButtonShieldToggle = true;
                });
                $shield.tooltipster("open");
                return;
            }
            else {
                $shield.tooltipster("disable");
                $shield.removeAttr("data-shield-id");
                event.stopPropagation();
            }
            $shield.toggleClass("shield-activated");
            CONFIG.PF2E.chatDamageButtonShieldToggle = !CONFIG.PF2E.chatDamageButtonShieldToggle;
        });
        $shield.removeClass("shield-block");

        html.find('div.target-lock-chat-window').append("<span class='target-lock-target-name flavor-text'><b>Target: " + target.data.name +  "</b></span>");
        html.find('div.target-lock-chat-window').append(innerHtml);   
    };
    html.find('div.target-lock-chat-window').append("<hr class='target-lock'/>");
    return;
});

async function applyDamage(message, tokenID, multiplier, adjustment = 0, promptModifier = false) {
    console.group("target-lock | Apply Damage");
        console.info(`Message ID: ${message}`);
        console.info(`Token ID: ${tokenID}`);
        console.info(`Base Damage': ${message.roll.total}`);
        console.info(`multiplier: ${multiplier}`);
        console.info(`adjustment: ${adjustment}`);
        console.info(`Total Damage: ${message.roll.total * multiplier + adjustment}`);
    console.groupEnd();
    var _a;
    if (promptModifier)
        return shiftModifyDamage(message, tokenID, multiplier);
    //Modified here to include TokenID
    const tokens = canvas.tokens.ownedTokens.filter((token) => token.data._id === tokenID && token.actor);
    if (tokens.length === 0) {
        const errorMsg = "LocalizePF2e.translations.PF2E.UI.errorTargetToken";
        ui.notifications.error(errorMsg);
        return;
    }
    const shieldBlockRequest = CONFIG.PF2E.chatDamageButtonShieldToggle;
    const damage = message.roll.total * multiplier + adjustment;
    for (const token of tokens) {
        await ((_a = token.actor) === null || _a === void 0 ? void 0 : _a.applyDamage(damage, token, shieldBlockRequest));
    }
    toggleOffShieldBlock(message.id);
}

function shiftModifyDamage(message, tokenID, multiplier) {
    console.info("target-lock | Modify Damage");
    new Dialog({
        title: game.i18n.localize("PF2E.UI.shiftModifyDamageTitle"),
        content: `<form>
                <div class="form-group">
                    <label>${game.i18n.localize("PF2E.UI.shiftModifyDamageLabel")}</label>
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
                label: "Ok",
                callback: async ($dialog) => {
                    // In case of healing, multipler will have negative sign. The user will expect that positive
                    // modifier would increase healing value, while negative would decrease.
                    const adjustment = (Number($dialog.find('[name="modifier"]').val()) || 0) * Math.sign(multiplier);
                    applyDamage(message, tokenID, multiplier, adjustment);
                },
            },
        },
        default: "ok",
        close: () => {
            toggleOffShieldBlock(message.id);
        },
    }).render(true);
}
/** Toggle off the Shield Block button on a damage chat message */
function toggleOffShieldBlock(messageId) {
    console.info("target-lock | ToggleOffShieldBlock");
    const $message = $(`#chat-log > li.chat-message[data-message-id="${messageId}"]`);
    const $button = $message.find("button.shield-block");
    $button.removeClass("shield-activated");
    CONFIG.PF2E.chatDamageButtonShieldToggle = false;
}

