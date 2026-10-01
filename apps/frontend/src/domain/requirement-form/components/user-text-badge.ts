/**
 * Extra classes for a Badge whose content a coordinator typed — a field label,
 * a block name, a form name.
 *
 * Badge is `whitespace-nowrap shrink-0` by design, which is right for a status
 * chip whose text the product controls and wrong for text it does not: a German
 * compound with nowhere to break leaves the card rather than wrapping inside it.
 * Overridden here rather than in the base, which every status chip relies on.
 */
export const USER_TEXT_BADGE = 'max-w-full shrink whitespace-normal text-left';
