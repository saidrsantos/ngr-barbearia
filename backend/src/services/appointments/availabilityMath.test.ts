import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeAvailableSlots } from './availabilityMath';

// Segunda-feira fixa (2026-09-07) usada em todos os testes pra não depender do dia em que roda.
const MONDAY = new Date('2026-09-07T00:00:00');
const NOW = new Date('2026-09-06T12:00:00'); // véspera, à tarde

test('gera slots dentro do horário de funcionamento, respeitando a duração do serviço', () => {
  const slots = computeAvailableSlots({
    durationMin: 30,
    businessHours: [{ dayOfWeek: 1, openTime: '09:00', closeTime: '10:00', barberId: null }],
    activeBarberIds: [null],
    busyAppointments: [],
    range: { from: MONDAY, to: MONDAY },
    now: NOW,
  });

  assert.equal(slots.length, 2);
  assert.equal(slots[0].start.getHours(), 9);
  assert.equal(slots[0].start.getMinutes(), 0);
  assert.equal(slots[1].start.getHours(), 9);
  assert.equal(slots[1].start.getMinutes(), 30);
});

test('não gera slot que passaria do horário de fechamento', () => {
  const slots = computeAvailableSlots({
    durationMin: 40,
    businessHours: [{ dayOfWeek: 1, openTime: '09:00', closeTime: '10:00', barberId: null }],
    activeBarberIds: [null],
    busyAppointments: [],
    range: { from: MONDAY, to: MONDAY },
    now: NOW,
  });

  // 09:00-09:40 cabe, mas 09:40-10:20 estouraria o fechamento (10:00) — só 1 slot.
  assert.equal(slots.length, 1);
});

test('exclui slot que colide com agendamento existente do mesmo barbeiro', () => {
  const slots = computeAvailableSlots({
    durationMin: 30,
    businessHours: [{ dayOfWeek: 1, openTime: '09:00', closeTime: '10:00', barberId: 1 }],
    activeBarberIds: [1],
    busyAppointments: [
      { scheduledAt: new Date('2026-09-07T09:00:00'), barberId: 1, durationMin: 30 },
    ],
    range: { from: MONDAY, to: MONDAY },
    now: NOW,
  });

  assert.equal(slots.length, 1);
  assert.equal(slots[0].start.getMinutes(), 30);
});

test('não exclui slot de um barbeiro quando o conflito é de outro barbeiro', () => {
  const slots = computeAvailableSlots({
    durationMin: 30,
    businessHours: [
      { dayOfWeek: 1, openTime: '09:00', closeTime: '09:30', barberId: 1 },
      { dayOfWeek: 1, openTime: '09:00', closeTime: '09:30', barberId: 2 },
    ],
    activeBarberIds: [1, 2],
    busyAppointments: [
      { scheduledAt: new Date('2026-09-07T09:00:00'), barberId: 1, durationMin: 30 },
    ],
    range: { from: MONDAY, to: MONDAY },
    now: NOW,
  });

  assert.equal(slots.length, 1);
  assert.equal(slots[0].barberId, 2);
});

test('não gera slot no passado', () => {
  const slots = computeAvailableSlots({
    durationMin: 30,
    businessHours: [{ dayOfWeek: 1, openTime: '00:00', closeTime: '23:30', barberId: null }],
    activeBarberIds: [null],
    busyAppointments: [],
    range: { from: MONDAY, to: MONDAY },
    now: new Date('2026-09-07T12:00:00'), // meio do próprio dia
  });

  assert.ok(slots.every((s) => s.start.getTime() > new Date('2026-09-07T12:00:00').getTime()));
  assert.ok(slots.length > 0);
});

test('ignora dias da semana sem horário cadastrado', () => {
  const TUESDAY = new Date('2026-09-08T00:00:00');
  const slots = computeAvailableSlots({
    durationMin: 30,
    businessHours: [{ dayOfWeek: 1, openTime: '09:00', closeTime: '10:00', barberId: null }], // só segunda
    activeBarberIds: [null],
    busyAppointments: [],
    range: { from: TUESDAY, to: TUESDAY },
    now: NOW,
  });

  assert.equal(slots.length, 0);
});
