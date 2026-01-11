<script lang="ts">
	import { onMount } from "svelte"
	import { inputManager, eventsManager, landmarkManager, systemState } from "../../systems"
	import type { Landmark } from "../../systems/LandmarkManager"

	let isVisible = $state(false)
	let selectedId = $state<string | null>(null)
	let landmarks = $state<Landmark[]>([])

	const radius = 140 // px from center

	// Reactive slot calculations
	let slotCount = $derived(landmarks.length)
	let slotAngle = $derived(slotCount > 0 ? 360 / slotCount : 0)

	onMount(() => {
		// Poll for L key press
		const unsubscribeUpdate = eventsManager.on("engine-update", () => {
			isVisible = inputManager.isKeyPressed("KeyL")
		})

		// Update landmarks list when discovery changes
		const unsubscribeDiscovery = eventsManager.on("landmark-discovered", () => {
			landmarks = landmarkManager.getAll()
		})

		// Initial load of landmarks
		landmarks = landmarkManager.getAll()

		return () => {
			unsubscribeUpdate()
			unsubscribeDiscovery()
		}
	})

	function getSlotStyle(index: number): string {
		const angle = index * slotAngle - 90 // Start from top (-90deg)
		const staggerDelay = index * 0.04 // Staggered animation delay
		return `--angle: ${angle}deg; --radius: ${radius}px; --stagger-delay: ${staggerDelay}s; --index: ${index};`
	}

	function onSlotClick(landmark: Landmark) {
		if (!landmark.hasBeenDiscovered) return
		selectedId = landmark.id

		// Activate wind toward this landmark
		if (landmark.windTargetId) {
			systemState.wind.activateTargetById(landmark.windTargetId)
			eventsManager.emit("landmark-selected", landmark.id)
		}
	}
</script>

{#if landmarks.length > 0}
<div class="radial-menu" class:visible={isVisible}>
	<!-- Backdrop ring -->
	<div class="backdrop-ring"></div>

	<div class="slots-container">
		{#each landmarks as landmark, index}
			<button
				class="slot"
				class:discovered={landmark.hasBeenDiscovered}
				class:selected={selectedId === landmark.id}
				style={getSlotStyle(index)}
				onclick={() => onSlotClick(landmark)}
				disabled={!landmark.hasBeenDiscovered}
			>
				<span class="slot-content">
					{#if landmark.hasBeenDiscovered}
						<span class="icon">{landmark.icon}</span>
						<span class="name">{landmark.name}</span>
					{:else}
						<span class="icon unknown">?</span>
					{/if}
				</span>
			</button>
		{/each}
	</div>

	<!-- Center indicator -->
	<div class="center-indicator">
		<div class="center-dot"></div>
		<div class="center-ring"></div>
	</div>

	<!-- Hint text -->
	<div class="hint">Hold L to select landmark</div>
</div>
{/if}

<style>
	.radial-menu {
		position: fixed;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%) scale(0.8);
		opacity: 0;
		visibility: hidden;
		transition:
			opacity 0.25s cubic-bezier(0.4, 0, 0.2, 1),
			transform 0.25s cubic-bezier(0.4, 0, 0.2, 1),
			visibility 0.25s;
		pointer-events: none;
	}

	.radial-menu.visible {
		opacity: 1;
		visibility: visible;
		pointer-events: auto;
		transform: translate(-50%, -50%) scale(1);
	}

	/* Backdrop ring */
	.backdrop-ring {
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		width: 320px;
		height: 320px;
		border-radius: 50%;
		background: radial-gradient(
			circle,
			rgba(0, 0, 0, 0.6) 0%,
			rgba(0, 0, 0, 0.4) 50%,
			rgba(0, 0, 0, 0) 70%
		);
		backdrop-filter: blur(8px);
		-webkit-backdrop-filter: blur(8px);
	}

	.slots-container {
		position: relative;
		width: 0;
		height: 0;
	}

	.slot {
		position: absolute;
		width: 90px;
		height: 90px;
		border-radius: 50%;
		border: 2px solid rgba(255, 255, 255, 0.15);
		background: rgba(20, 20, 25, 0.85);
		backdrop-filter: blur(12px);
		-webkit-backdrop-filter: blur(12px);
		color: white;
		cursor: default;
		display: flex;
		align-items: center;
		justify-content: center;
		transform: rotate(var(--angle)) translateX(var(--radius)) rotate(calc(-1 * var(--angle))) scale(0);
		margin-left: -45px;
		margin-top: -45px;
		transition:
			transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1),
			background 0.2s ease-out,
			border-color 0.2s ease-out,
			box-shadow 0.2s ease-out;
		box-shadow:
			0 4px 20px rgba(0, 0, 0, 0.4),
			inset 0 1px 0 rgba(255, 255, 255, 0.1);
	}

	/* Staggered entrance animation */
	.radial-menu.visible .slot {
		transform: rotate(var(--angle)) translateX(var(--radius)) rotate(calc(-1 * var(--angle))) scale(1);
		transition-delay: var(--stagger-delay);
	}

	.slot.discovered {
		cursor: pointer;
		border-color: rgba(255, 255, 255, 0.35);
	}

	.slot.discovered:hover {
		background: rgba(40, 40, 50, 0.95);
		border-color: rgba(255, 255, 255, 0.7);
		box-shadow:
			0 4px 20px rgba(0, 0, 0, 0.4),
			0 0 30px rgba(255, 255, 255, 0.15),
			inset 0 1px 0 rgba(255, 255, 255, 0.2);
		transform: rotate(var(--angle)) translateX(var(--radius)) rotate(calc(-1 * var(--angle))) scale(1.12);
		transition-delay: 0s;
	}

	.slot.discovered.selected {
		border-color: rgba(187, 1, 45, 0.9);
		box-shadow:
			0 4px 20px rgba(0, 0, 0, 0.4),
			0 0 25px rgba(187, 1, 45, 0.4),
			inset 0 1px 0 rgba(255, 255, 255, 0.1);
	}

	.slot:not(.discovered) {
		opacity: 0.4;
		border-style: dashed;
	}

	.slot-content {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 4px;
		text-align: center;
	}

	.icon {
		font-size: 1.75rem;
		line-height: 1;
		filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3));
	}

	.icon.unknown {
		font-size: 1.5rem;
		font-weight: 300;
		font-family: system-ui, sans-serif;
		opacity: 0.6;
	}

	.name {
		font-size: 0.6rem;
		font-weight: 600;
		font-family: system-ui, sans-serif;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		max-width: 75px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		opacity: 0.9;
		text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
	}

	/* Center indicator */
	.center-indicator {
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
	}

	.center-dot {
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		width: 12px;
		height: 12px;
		border-radius: 50%;
		background: rgba(255, 255, 255, 0.9);
		box-shadow: 0 0 15px rgba(255, 255, 255, 0.5);
	}

	.center-ring {
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		width: 36px;
		height: 36px;
		border-radius: 50%;
		border: 2px solid rgba(255, 255, 255, 0.3);
		animation: pulse 2s ease-in-out infinite;
	}

	@keyframes pulse {
		0%, 100% {
			transform: translate(-50%, -50%) scale(1);
			opacity: 0.5;
		}
		50% {
			transform: translate(-50%, -50%) scale(1.15);
			opacity: 0.3;
		}
	}

	/* Hint text */
	.hint {
		position: absolute;
		top: calc(50% + 180px);
		left: 50%;
		transform: translateX(-50%);
		font-size: 0.7rem;
		font-family: system-ui, sans-serif;
		font-weight: 500;
		text-transform: uppercase;
		letter-spacing: 0.15em;
		color: rgba(255, 255, 255, 0.4);
		white-space: nowrap;
	}
</style>
