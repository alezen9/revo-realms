<script lang="ts">
	import { onMount } from "svelte"
	import { eventsManager } from "../../systems"
	import { realmConfig } from "../../realm/config"
	import compassUrl from "/textures/hud/compass.webp?url"
	import arrowUrl from "/textures/hud/compassArrow.webp?url"

	let opacity = $state(0)
	let arrowYaw = $state(0)

	const distanceThreshold = realmConfig.MAP_SIZE / 2

	const unwrapAngle = (prev: number, next: number) => {
		const diff = next - prev
		return prev + (((diff + Math.PI) % (2 * Math.PI)) - Math.PI)
	}

	onMount(() => {
		let relativeAngle = 0

		const unsubscribe = eventsManager.on("engine-update-throttle-16x", ({ player }) => {
			const isFarX = Math.abs(player.position.x) > distanceThreshold
			const isFarZ = Math.abs(player.position.z) > distanceThreshold
			const isFar = isFarX || isFarZ

			opacity = isFar ? 0.65 : 0
			if (!isFar) return

			const angleToCenter = Math.atan2(-player.position.x, -player.position.z)
			relativeAngle = unwrapAngle(relativeAngle, angleToCenter - player.yaw)
			arrowYaw = -relativeAngle
		})

		return () => {
			unsubscribe()
		}
	})
</script>

<div class="compass-container" style={`--opacity: ${opacity};`}>
	<img class="compass" src={compassUrl} alt="compass" />
	<img
		class="compass-arrow"
		src={arrowUrl}
		alt="arrow"
		style={`--yaw: ${arrowYaw}rad;`}
	/>
</div>

<style>
	.compass-container {
		--opacity: 0;
		--size: min(10vh, 7.5vw);
		--padding: 1rem;
		position: fixed;
		bottom: var(--padding);
		right: var(--padding);
		opacity: var(--opacity);
		width: var(--size);
		height: var(--size);
		filter: drop-shadow(0 0 10px black);
		transition: opacity 0.5s ease-in-out;
		pointer-events: none;
	}

	.compass {
		position: absolute;
		width: 100%;
	}

	.compass-arrow {
		--yaw: 0;
		position: absolute;
		width: 100%;
		transform: rotateZ(calc(var(--yaw) + 180deg));
		will-change: transform;
		transition: transform 0.15s linear;
	}
</style>
