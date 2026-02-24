<script lang="ts">
	import { onMount } from "svelte"
	import {
		eventsManager,
		landmarkManager,
		timeManager,
		windManager,
	} from "../../systems"
	import type { Landmark } from "../../systems/LandmarkManager"

	let isVisible = $state(false)
	let landmarks = $state<Landmark[]>([])
	let activeWindTargetId = $state<string | null>(null)

	const innerRadius = 78
	const outerRadius = 178
	const gapAngleDeg = 4
	const svgSize = 400
	const center = svgSize / 2
	const labelRadius = (innerRadius + outerRadius) / 2
	let menuEl = $state.raw<HTMLDivElement | null>(null)

	const toRad = (deg: number) => (deg * Math.PI) / 180
	const toPoint = (radius: number, angleRad: number) => ({
		x: center + radius * Math.cos(angleRad),
		y: center + radius * Math.sin(angleRad),
	})
	const buildSlots = (items: Landmark[]) => {
		if (!items.length) return []
		const slotAngleDeg = 360 / items.length
		const slotAngleRad = toRad(slotAngleDeg)
		const outerGapRad = toRad(gapAngleDeg)
		const innerGapRad = Math.min(
			(outerGapRad * outerRadius) / innerRadius,
			Math.max(slotAngleRad - 0.02, 0),
		)

		return items.map((landmark, index) => {
			const baseStart = toRad(index * slotAngleDeg - 90)
			const baseEnd = baseStart + slotAngleRad
			const outerStart = baseStart + outerGapRad / 2
			const outerEnd = baseEnd - outerGapRad / 2
			const innerStart = baseStart + innerGapRad / 2
			const innerEnd = baseEnd - innerGapRad / 2

			const outerLargeArc = outerEnd - outerStart > Math.PI ? 1 : 0
			const innerLargeArc = innerEnd - innerStart > Math.PI ? 1 : 0

			const outerStartPos = toPoint(outerRadius, outerStart)
			const outerEndPos = toPoint(outerRadius, outerEnd)
			const innerStartPos = toPoint(innerRadius, innerStart)
			const innerEndPos = toPoint(innerRadius, innerEnd)
			const labelPos = toPoint(labelRadius, (outerStart + outerEnd) / 2)

			return {
				landmark,
				labelX: labelPos.x,
				labelY: labelPos.y,
				delay: `${index * 0.05}s`,
				path: `M ${outerStartPos.x} ${outerStartPos.y} A ${outerRadius} ${outerRadius} 0 ${outerLargeArc} 1 ${outerEndPos.x} ${outerEndPos.y} L ${innerEndPos.x} ${innerEndPos.y} A ${innerRadius} ${innerRadius} 0 ${innerLargeArc} 0 ${innerStartPos.x} ${innerStartPos.y} Z`,
			}
		})
	}

	let slots = $derived(buildSlots(landmarks))
	let selectedId = $derived(
		activeWindTargetId
			? (landmarks.find(
					landmark => landmark.windTargetId === activeWindTargetId,
				)?.id ?? null)
			: null,
	)
	let menuVisible = $derived(isVisible && slots.length > 0)

	const getFocusableSlots = () =>
		Array.from(
			menuEl?.querySelectorAll<SVGGElement>(
				".radial-menu__slot[tabindex='0']",
			) ?? [],
		)

	const handleSlotClick = (landmark: Landmark) => {
		if (!landmark.hasBeenDiscovered || !landmark.windTargetId) return
		const isActivated = windManager.activateTargetById(landmark.windTargetId)
		if (!isActivated) return
		eventsManager.emit("landmark-selected", landmark.id)
		isVisible = false
	}

	onMount(() => {
		const unsubscribeDiscovery = eventsManager.on("landmark-discovered", () => {
			landmarks = landmarkManager.getAll()
		})
		const unsubscribeWindTarget = eventsManager.on(
			"wind-target-change",
			(targetId: string | null) => {
				activeWindTargetId = targetId
			},
		)
		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.code === "KeyL" && !event.repeat) {
				isVisible = !isVisible
				return
			}
			if (!menuVisible) return
			if (event.code === "Escape") {
				isVisible = false
				return
			}
			if (event.key === "Tab") {
				event.preventDefault()
				const focusable = getFocusableSlots()
				if (!focusable.length) return
				const currentIndex = focusable.indexOf(
					document.activeElement as SVGGElement,
				)
				const direction = event.shiftKey ? -1 : 1
				const nextIndex =
					currentIndex === -1
						? 0
						: (currentIndex + direction + focusable.length) % focusable.length
				focusable[nextIndex].focus()
			}
		}
		const handlePointerDown = (event: PointerEvent) => {
			if (
				menuVisible &&
				menuEl &&
				event.target instanceof Node &&
				!menuEl.contains(event.target)
			) {
				isVisible = false
			}
		}
		window.addEventListener("keydown", handleKeyDown)
		window.addEventListener("pointerdown", handlePointerDown)

		landmarks = landmarkManager.getAll()
		activeWindTargetId = windManager.activeTargetId

		return () => {
			unsubscribeDiscovery()
			unsubscribeWindTarget()
			window.removeEventListener("keydown", handleKeyDown)
			window.removeEventListener("pointerdown", handlePointerDown)
		}
	})

	$effect(() => {
		timeManager.setSlowMotionEnabled(menuVisible)
		return () => {
			if (menuVisible) timeManager.setSlowMotionEnabled(false)
		}
	})

	$effect(() => {
		if (!menuVisible) return
		requestAnimationFrame(() => {
			const focusable = getFocusableSlots()
			if (!focusable.length) return
			const selected = selectedId
				? focusable.find(element => element.dataset.landmarkId === selectedId)
				: null
			;(selected ?? focusable[0]).focus()
		})
	})
</script>

{#if slots.length > 0}
	<div class="radial-menu" class:open={menuVisible} bind:this={menuEl}>
		<svg
			class="radial-menu__ring"
			viewBox="0 0 {svgSize} {svgSize}"
			width={svgSize}
			height={svgSize}
		>
			{#each slots as slot (slot.landmark.id)}
				{@const landmark = slot.landmark}
				<g
					class="radial-menu__slot"
					class:discovered={landmark.hasBeenDiscovered}
					class:selected={selectedId === landmark.id}
					style="--delay: {slot.delay}"
					onclick={() => handleSlotClick(landmark)}
					onkeydown={event =>
						event.key === "Enter" && handleSlotClick(landmark)}
					role="button"
					tabindex={menuVisible && landmark.hasBeenDiscovered ? 0 : -1}
					data-landmark-id={landmark.id}
					aria-label={landmark.hasBeenDiscovered
						? landmark.name
						: "Undiscovered landmark"}
				>
					<path class="radial-menu__arc" d={slot.path} />

					<text
						class="radial-menu__icon"
						x={slot.labelX}
						y={slot.labelY - 6}
						text-anchor="middle"
						dominant-baseline="middle"
					>
						{landmark.hasBeenDiscovered ? landmark.icon : "?"}
					</text>

					{#if landmark.hasBeenDiscovered}
						<text
							class="radial-menu__label"
							x={slot.labelX}
							y={slot.labelY + 16}
							text-anchor="middle"
							dominant-baseline="middle"
						>
							{landmark.name}
						</text>
					{/if}
				</g>
			{/each}
		</svg>

		<div class="radial-menu__hints" aria-live="polite">
			<div class="radial-menu__hint">Press L or Esc to close</div>
			{#if selectedId}
				<div class="radial-menu__hint radial-menu__hint--secondary">
					Swipe up or scroll up to call wind
				</div>
			{/if}
		</div>
	</div>
{/if}

<style>
	.radial-menu {
		--menu-scale: 0.85;
		position: fixed;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%) scale(var(--menu-scale));
		opacity: 0;
		visibility: hidden;
		transition:
			opacity 0.25s cubic-bezier(0.4, 0, 0.2, 1),
			transform 0.25s cubic-bezier(0.4, 0, 0.2, 1),
			visibility 0.25s;
		pointer-events: none;
		z-index: 100;
	}

	.radial-menu.open {
		--menu-scale: 1;
		opacity: 1;
		visibility: visible;
		pointer-events: auto;
	}

	.radial-menu__ring {
		overflow: visible;
	}

	.radial-menu__slot {
		cursor: default;
		outline: none;
	}

	.radial-menu__slot:focus-visible .radial-menu__arc {
		stroke: rgba(255, 255, 255, 0.8);
		stroke-width: 2;
	}

	.radial-menu__slot.discovered {
		cursor: pointer;
	}

	.radial-menu__arc {
		fill: rgba(15, 15, 20, 0.85);
		stroke: rgba(255, 255, 255, 0.12);
		stroke-width: 1.5;
		transform-origin: center;
		transform: scale(0);
		transition:
			transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) var(--delay),
			fill 0.2s ease-out 0s,
			stroke 0.2s ease-out 0s,
			stroke-width 0.2s ease-out 0s;
	}

	.radial-menu.open .radial-menu__arc {
		transform: scale(1);
	}

	.radial-menu__slot.discovered .radial-menu__arc {
		stroke: rgba(255, 255, 255, 0.25);
	}

	.radial-menu__slot.discovered:hover .radial-menu__arc {
		fill: rgba(35, 38, 48, 0.95);
		stroke: rgba(255, 255, 255, 0.7);
		stroke-width: 2;
	}

	.radial-menu__slot.selected .radial-menu__arc {
		fill: rgba(28, 48, 36, 0.92);
		stroke: rgba(46, 200, 118, 0.95);
		stroke-width: 2.2;
	}

	.radial-menu__slot:not(.discovered) .radial-menu__arc {
		opacity: 0.35;
		stroke-dasharray: 6 4;
	}

	.radial-menu__icon,
	.radial-menu__label {
		opacity: 0;
		transition: opacity 0.25s ease-out;
		pointer-events: none;
	}

	.radial-menu__icon {
		font-size: 26px;
		fill: white;
		transition-delay: calc(var(--delay) + 0.1s);
		/* filter: drop-shadow(0 2px 3px rgba(0, 0, 0, 0.4)); */
	}

	.radial-menu.open .radial-menu__icon {
		opacity: 1;
	}

	.radial-menu__slot:not(.discovered) .radial-menu__icon {
		font-family: system-ui, sans-serif;
		font-weight: 300;
		font-size: 22px;
	}

	.radial-menu.open .radial-menu__slot:not(.discovered) .radial-menu__icon {
		opacity: 0.5;
	}

	.radial-menu__label {
		font-size: 9px;
		font-family: system-ui, sans-serif;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		fill: rgba(255, 255, 255, 0.85);
		transition-delay: calc(var(--delay) + 0.15s);
	}

	.radial-menu.open .radial-menu__label {
		opacity: 1;
	}

	.radial-menu__hints {
		position: absolute;
		top: calc(50% + 220px);
		left: 50%;
		transform: translateX(-50%);
		display: grid;
		justify-items: center;
		gap: 6px;
		pointer-events: none;
	}

	.radial-menu__hint {
		font-size: 0.65rem;
		font-family: system-ui, sans-serif;
		font-weight: 500;
		text-transform: uppercase;
		letter-spacing: 0.2em;
		color: rgba(255, 255, 255, 0.35);
		white-space: nowrap;
	}

	.radial-menu__hint--secondary {
		color: rgba(255, 255, 255, 0.5);
	}
</style>
