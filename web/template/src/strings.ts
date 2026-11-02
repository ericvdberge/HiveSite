import type { Strings } from '@hivesite/blocks'

const en: Strings = {
    skipLink: 'Skip to content',
    mainMenu: 'Main menu',
    required: 'required',
    previewLabel: 'Preview · not published',
    notFoundTitle: 'Page not found',
    notFoundText: 'This page does not exist (any more).',
    backHome: 'Back to the home page',
    gallery: 'Gallery',
    cardList: 'Cards',
    contactForm: 'Contact form',
}

const nl: Strings = {
    skipLink: 'Naar de inhoud',
    mainMenu: 'Hoofdmenu',
    required: 'verplicht',
    previewLabel: 'Voorbeeld · niet gepubliceerd',
    notFoundTitle: 'Pagina niet gevonden',
    notFoundText: 'Deze pagina bestaat niet (meer).',
    backHome: 'Terug naar de startpagina',
    gallery: 'Galerij',
    cardList: 'Kaarten',
    contactForm: 'Contactformulier',
}

/** `nl` gets Dutch, every other language English, by the primary subtag. */
export function stringsFor(language: string): Strings {
    return language.split('-')[0]?.toLowerCase() === 'nl' ? nl : en
}
