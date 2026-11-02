"use client";

import { useMemo, useState } from "react";
import { money, type Order } from "@/lib/types";
import { paidOrderSalesValue } from "@/lib/sales";
import "./overview-charts.css";

const dayKey = (date: Date) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
const minutesText = (value: number | null) =>
  value === null
    ? "—"
    : value < 60
      ? `${Math.round(value)} menit`
      : `${(value / 60).toFixed(1).replace(".", ",")} jam`;

type ChartDay = { key: string; label: string; value: number | null };

/** Days without observations are left as gaps rather than plotted as zero. */
function LineChart({
  days,
  label,
  formatValue,
  color,
}: {
  days: ChartDay[];
  label: string;
  formatValue: (value: number | null) => string;
  color: "sales" | "response";
}) {
  const [selected, setSelected] = useState(days.length - 1);
  const selectedDay = days[Math.min(selected, days.length - 1)];
  const width = 700;
  const height = 160;
  const left = 28;
  const right = width - left;
  const top = 16;
  const bottom = height - 14;
  const peak = Math.max(...days.map((day) => day.value ?? 0), 1);
  const points = days.map((day, index) => ({
    ...day,
    x: left + (index / Math.max(days.length - 1, 1)) * (right - left),
    y: day.value === null ? null : bottom - (day.value / peak) * (bottom - top),
  }));
  let connected = false;
  const path = points
    .map((point) => {
      if (point.y === null) {
        connected = false;
        return "";
      }
      const command = connected ? "L" : "M";
      connected = true;
      return `${command} ${point.x} ${point.y}`;
    })
    .join(" ");

  return (
    <div className={`overview-line-chart overview-line-${color}`}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={`${label}: ${days.map((day) => `${day.label} ${formatValue(day.value)}`).join(", ")}`}
      >
        {[0, 1, 2, 3].map((index) => {
          const y = top + (index / 3) * (bottom - top);
          return (
            <line
              key={index}
              className="overview-line-grid"
              x1={left}
              y1={y}
              x2={right}
              y2={y}
            />
          );
        })}
        {color === "sales" && path && (
          <path
            className="overview-line-area"
            d={`${path} L ${right} ${bottom} L ${left} ${bottom} Z`}
          />
        )}
        {path && <path className="overview-line-path" d={path} />}
        {points.map(
          (point, index) =>
            point.y !== null && (
              <circle
                key={point.key}
                className={`overview-line-point${index === selected ? " is-selected" : ""}`}
                cx={point.x}
                cy={point.y}
                r="4.5"
              >
                <title>
                  {point.label}: {formatValue(point.value)}
                </title>
              </circle>
            ),
        )}
      </svg>
      <div
        className="overview-line-labels"
        role="group"
        aria-label={`Pilih tanggal untuk ${label.toLowerCase()}`}
      >
        {days.map((day, index) => (
          <button
            key={day.key}
            type="button"
            className={index === selected ? "is-selected" : undefined}
            aria-pressed={index === selected}
            aria-label={`${day.label}: ${formatValue(day.value)}`}
            onClick={() => setSelected(index)}
          >
            {day.label}
          </button>
        ))}
      </div>
      {selectedDay && (
        <p className="overview-line-selection" aria-live="polite">
          {selectedDay.label} <b>{formatValue(selectedDay.value)}</b>
        </p>
      )}
    </div>
  );
}

export default function OverviewCharts({
  orders,
  hasMore,
}: {
  orders: Order[];
  hasMore?: boolean;
}) {
  const stats = useMemo(() => {
    const today = Date.now();
    const days = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(today - (6 - index) * 86400000);
      return {
        key: dayKey(date),
        label: new Intl.DateTimeFormat("id-ID", {
          timeZone: "Asia/Jakarta",
          weekday: "short",
          day: "numeric",
        }).format(date),
        total: 0,
        responseMinutes: [] as number[],
      };
    });
    let missingPaidDates = 0;
    const responses: number[] = [];
    const completions: number[] = [];
    for (const order of orders) {
      if (
        order.paid &&
        !order.paymentReconciliationRequired &&
        order.payment?.environment !== "sandbox"
      ) {
        const paid =
          order.paidAt ||
          order.manualPayment?.confirmedAt ||
          order.payment?.paidAt;
        const date = paid ? new Date(paid) : null;
        if (!date || !Number.isFinite(date.getTime())) missingPaidDates++;
        else {
          const bucket = days.find((day) => day.key === dayKey(date));
          if (bucket) bucket.total += paidOrderSalesValue(order);
        }
      }
      const start = Date.parse(order.createdAt);
      if (!Number.isFinite(start)) continue;
      if (order.source === "web") {
        const response = order.history.find(
          (entry) =>
            entry.status > 0 &&
            Number.isFinite(Date.parse(entry.at)) &&
            Date.parse(entry.at) >= start,
        );
        if (response) {
          const elapsed = (Date.parse(response.at) - start) / 60000;
          responses.push(elapsed);
          days
            .find((day) => day.key === dayKey(new Date(response.at)))
            ?.responseMinutes.push(elapsed);
        }
      }
      const finish = order.history.find(
        (entry) =>
          entry.status === 7 &&
          Number.isFinite(Date.parse(entry.at)) &&
          Date.parse(entry.at) >= start,
      );
      if (finish) completions.push((Date.parse(finish.at) - start) / 60000);
    }
    const average = (values: number[]) =>
      values.length
        ? values.reduce((sum, value) => sum + value, 0) / values.length
        : null;
    return {
      days,
      missingPaidDates,
      response: average(responses),
      responseCount: responses.length,
      completion: average(completions),
      completionCount: completions.length,
    };
  }, [orders]);
  const responseDays = stats.days.map((day) => ({
    ...day,
    average: day.responseMinutes.length
      ? day.responseMinutes.reduce((sum, value) => sum + value, 0) /
        day.responseMinutes.length
      : null,
  }));
  return (
    <div className="overview-charts" data-scroll-reveal>
      <section className="panel overview-sales">
        <div className="overview-chart-heading">
          <div>
            <h3>Nilai penjualan lunas</h3>
            <p>7 hari terakhir · berdasarkan waktu pembayaran</p>
          </div>
          <strong>
            {money(stats.days.reduce((sum, day) => sum + day.total, 0))}
          </strong>
        </div>
        <LineChart
          days={stats.days.map((day) => ({ ...day, value: day.total }))}
          label="Nilai penjualan 7 hari terakhir"
          formatValue={(value) => money(value ?? 0)}
          color="sales"
        />
        <p className="overview-chart-note">
          Nilai pesanan termasuk pembayaran dengan saldo membership, bukan
          jumlah uang yang diterima.
        </p>
        {stats.missingPaidDates > 0 && (
          <p className="overview-chart-note">
            {stats.missingPaidDates} pesanan lunas lama tidak memiliki waktu
            pembayaran dan tidak masuk grafik.
          </p>
        )}
        {hasMore && (
          <p className="overview-chart-note">
            Berdasarkan 500 pesanan terbaru.
          </p>
        )}
      </section>
      <section className="panel overview-service-time">
        <h3>Kecepatan layanan</h3>
        <p>Rata-rata berdasarkan riwayat status</p>
        <div>
          <span>Respons pesanan online</span>
          <strong>{minutesText(stats.response)}</strong>
          <small>{stats.responseCount} pesanan dengan respons tercatat</small>
        </div>
        <div>
          <span>Pesanan hingga selesai</span>
          <strong>{minutesText(stats.completion)}</strong>
          <small>{stats.completionCount} pesanan selesai</small>
        </div>
        <div className="overview-response-chart">
          <span>Respons harian · 7 hari terakhir</span>
          <LineChart
            days={responseDays.map((day) => ({ ...day, value: day.average }))}
            label="Rata-rata respons harian"
            formatValue={minutesText}
            color="response"
          />
          {responseDays.every((day) => day.average === null) && (
            <small>Belum ada respons tercatat dalam 7 hari terakhir.</small>
          )}
        </div>
        <p className="overview-chart-note">
          Waktu dihitung dari pesanan dibuat hingga status pertama berubah atau
          selesai. Belum membandingkan target SLA.
        </p>
      </section>
    </div>
  );
}
