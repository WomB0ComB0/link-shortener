export default defineAppConfig({
	ui: {
		// Map semantic names to the palettes exposed in CSS. Use `purple` as the
		// primary palette per the user's request.
		colors: {
			primary: "purple",
			secondary: "secondary",
			neutral: "muted",
			success: "accent",
			error: "destructive",
			info: "accent",
		},
	},
});
