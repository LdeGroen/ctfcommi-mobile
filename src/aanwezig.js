import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { chat } from './api';

/**
 * Wie zit er nu in de app?
 *
 * Eén klok voor de hele app: elke minuut één verzoek dat tegelijk zegt "ik ben
 * er" en teruggeeft wie er nog meer zijn. Schermen schrijven zich in op het
 * resultaat, zodat tien avatars niet tien verzoeken opleveren.
 *
 * Zodra de app naar de achtergrond gaat stopt het kloppen. Dat is de bedoeling:
 * een telefoon in je zak is geen aanwezigheid, en zonder die stop zou iedereen
 * de hele dag online lijken.
 */

const INTERVAL_MS = 60 * 1000;

let ids = new Set();
const luisteraars = new Set();
let timer = null;
let appStateSub = null;

const meld = () => luisteraars.forEach((fn) => fn(ids));

const klop = async () => {
    try {
        const res = await chat.aanwezig();
        ids = new Set((res?.online || []).map(Number));
        meld();
    } catch {
        // Geen verbinding: laat staan wat we hadden. Een bolletje dat even
        // achterloopt is minder vervelend dan een lijst die leegklapt.
    }
};

const start = () => {
    if (timer) return;
    klop();
    timer = setInterval(() => {
        if (AppState.currentState === 'active') klop();
    }, INTERVAL_MS);
    // Terug uit de achtergrond: meteen bijwerken in plaats van tot de
    // volgende minuut wachten.
    appStateSub = AppState.addEventListener('change', (st) => {
        if (st === 'active') klop();
    });
};

const stop = () => {
    if (!timer) return;
    clearInterval(timer);
    timer = null;
    appStateSub?.remove?.();
    appStateSub = null;
};

/** De verzameling ids van iedereen die nu online is. */
export function useOnline() {
    const [huidig, setHuidig] = useState(ids);

    useEffect(() => {
        luisteraars.add(setHuidig);
        start();
        return () => {
            luisteraars.delete(setHuidig);
            if (luisteraars.size === 0) stop();
        };
    }, []);

    return huidig;
}

/** Is deze ene persoon online? */
export function useIsOnline(userId) {
    const online = useOnline();
    return !!userId && online.has(Number(userId));
}
