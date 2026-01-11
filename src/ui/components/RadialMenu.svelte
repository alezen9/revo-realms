<script lang="ts">
	import { onMount } from "svelte"
	import { inputManager, eventsManager, landmarkManager, systemState } from "../../systems"
	import type { Landmark } from "../../systems/LandmarkManager"

	let isVisible = $state(false)
	let selectedId = $state<string | null>(null)
	let landmarks = $state<Landmark[]>([])

	const innerRadius = 90
	const outerRadius = 160
	const gapAngleDeg = 4
	const svgSize = 400
	const center = svgSize / 2
	const labelRadius = (innerRadius + outerRadius) / 2
	const DEG_TO_RAD = Math.PI / 180

	const toRad = (deg: number) => deg * DEG_TO_RAD
	const toPoint = (radius: number, angleRad: number) => ({
		x: center + radius * Math.cos(angleRad),
		y: center + radius * Math.sin(angleRad),
	})

	const buildSlots = (items: Landmark[], angleDeg: number) => {
		if (!items.length) return []
		const slotAngleRad = toRad(angleDeg)
		const outerGapRad = toRad(gapAngleDeg)
		const innerGapRad = Math.min(
			(outerGapRad * outerRadius) / innerRadius,
			Math.max(slotAngleRad - 0.02, 0)
		)

		return items.map((landmark, index) => {
			const baseStart = toRad(index * angleDeg - 90)
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

	let slotCount = $derived(landmarks.length)
	let slotAngleDeg = $derived(slotCount > 0 ? 360 / slotCount : 0)
	let slots = $derived(buildSlots(landmarks, slotAngleDeg))
	let lastVisibility = false

	const syncLandmarks = () => {
		landmarks = landmarkManager.getAll()
	}

	const updateVisibility = () => {
		const nextVisible = inputManager.isKeyPressed("KeyL")
		if (nextVisible !== isVisible) isVisible = nextVisible
	}

	const handleSlotClick = (landmark: Landmark) => {
		if (!landmark.hasBeenDiscovered) return
		selectedId = landmark.id

		if (landmark.windTargetId) {
			systemState.wind.activateTargetById(landmark.windTargetId)
			eventsManager.emit("landmark-selected", landmark.id)
		}
	}

	onMount(() => {
		const unsubscribeUpdate = eventsManager.on("engine-update", updateVisibility)
		const unsubscribeDiscovery = eventsManager.on("landmark-discovered", syncLandmarks)

		syncLandmarks()

		return () => {
			unsubscribeUpdate()
			unsubscribeDiscovery()
		}
	})

	$effect(() => {
		const menuVisible = isVisible && slots.length > 0
		if (menuVisible === lastVisibility) return
		lastVisibility = menuVisible
		eventsManager.emit("radial-menu-visibility", menuVisible)
	})
</script>

{#if slots.length > 0}
	<div class="radial-menu" class:open={isVisible}>
		<svg
			class="radial-menu__ring"
			viewBox="0 0 {svgSize} {svgSize}"
			width={svgSize}
			height={svgSize}
		>
			<defs>
				<filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
					<feGaussianBlur stdDeviation="3" result="blur" />
					<feMerge>
						<feMergeNode in="blur" />
						<feMergeNode in="SourceGraphic" />
					</feMerge>
				</filter>
				<filter id="selectedGlow" x="-50%" y="-50%" width="200%" height="200%">
					<feGaussianBlur stdDeviation="6" result="blur" />
					<feMerge>
						<feMergeNode in="blur" />
						<feMergeNode in="SourceGraphic" />
					</feMerge>
				</filter>
			</defs>

			{#each slots as slot (slot.landmark.id)}
				{@const landmark = slot.landmark}
				<g
					class="radial-menu__slot"
					class:discovered={landmark.hasBeenDiscovered}
					class:selected={selectedId === landmark.id}
					style="--delay: {slot.delay}"
					onclick={() => handleSlotClick(landmark)}
					onkeydown={event => event.key === "Enter" && handleSlotClick(landmark)}
					role="button"
					tabindex={landmark.hasBeenDiscovered ? 0 : -1}
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

			<circle class="radial-menu__center-ring" cx={center} cy={center} r="24" />
			<circle class="radial-menu__center-dot" cx={center} cy={center} r="6" />
		</svg>

		<div class="radial-menu__hint">Hold L to select landmark</div>
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
			transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1),
			fill 0.2s ease-out,
			stroke 0.2s ease-out,
			filter 0.2s ease-out;
		transition-delay: var(--delay);
	}

	.radial-menu.open .radial-menu__arc {
		transform: scale(1);
	}

	.radial-menu__slot.discovered .radial-menu__arc {
		stroke: rgba(255, 255, 255, 0.25);
	}

	.radial-menu__slot.discovered:hover .radial-menu__arc {
		fill: rgba(30, 30, 40, 0.95);
		stroke: rgba(255, 255, 255, 0.6);
		filter: url(#glow);
	}

	.radial-menu__slot.selected .radial-menu__arc {
		stroke: rgba(187, 1, 45, 0.8);
		filter: url(#selectedGlow);
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
		filter: drop-shadow(0 2px 3px rgba(0, 0, 0, 0.4));
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

	.radial-menu__center-ring {
		fill: none;
		stroke: rgba(255, 255, 255, 0.25);
		stroke-width: 1.5;
		animation: pulse 2.5s ease-in-out infinite;
	}

	.radial-menu__center-dot {
		fill: rgba(255, 255, 255, 0.9);
		filter: drop-shadow(0 0 8px rgba(255, 255, 255, 0.5));
	}

	@keyframes pulse {
		0%,
		100% {
			transform: scale(1);
			opacity: 0.4;
		}
		50% {
			transform: scale(1.1);
			opacity: 0.2;
		}
	}

	.radial-menu__hint {
		position: absolute;
		top: calc(50% + 220px);
		left: 50%;
		transform: translateX(-50%);
		font-size: 0.65rem;
		font-family: system-ui, sans-serif;
		font-weight: 500;
		text-transform: uppercase;
		letter-spacing: 0.2em;
		color: rgba(255, 255, 255, 0.35);
		white-space: nowrap;
	}
</style>
