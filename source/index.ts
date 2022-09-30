import Logger, { Level, Rule } from "@jaxydog/clogts"
import dayjs from "dayjs"
import { BitFieldResolvable, Client, GatewayIntentsString, Partials } from "discord.js"
import {
	ButtonActionManager,
	CommandActionManager,
	ModalActionManager,
	SelectMenuActionManager,
} from "./internal/action"
import { CacheStorage, DualStorage } from "./internal/data"
import { Timer } from "./internal/timer"

export * from "./internal/action"
export * from "./internal/data"
export * from "./internal/timer"
export * from "./utility"

export interface ClientSettings {
	/** Client token for connecting to the Discord API */
	token: string
	/** Client gateway intents bitfield */
	intents: BitFieldResolvable<GatewayIntentsString, number>
	/** Client gateway partials array */
	partials?: Partials[]
	/** Log header; defaults to `Wyvern Client` */
	header?: string
	/** Log color; defaults to `#5865F2` */
	color?: string
	/** Development guild identifiers; used to register application commands; defaults to `[]` */
	dev_guilds?: string[]
	/** Whether to update global application commands; defaults to `false` */
	global_update?: boolean
	/** Timer interval in milliseconds; defaults to `30_000` (30 seconds) */
	timer_interval?: number
	/** Disables logging when set to `true`; defaults to `false` */
	silent?: boolean
	/** Enables log saving when set to `true`; defaults to `false` */
	save_logs?: boolean
}

/** Wyvern client wrapper */
export class WyvernClient {
	/** Button action manager */
	private readonly __buttons: ButtonActionManager
	/** Command action manager */
	private readonly __commands: CommandActionManager
	/** Modal action manager */
	private readonly __modals: ModalActionManager
	/** Select menu action manager */
	private readonly __select_menus: SelectMenuActionManager

	/** Discord client instance */
	public readonly client: Client
	/** Handles console output and log storage */
	public readonly logger: Logger
	/** Timer instance; handles regularly timed callback invocation */
	public readonly timer: Timer
	/** Local storage cache; this should not be exposed to the API */
	public readonly env = new CacheStorage()
	/** Main storage instance; has access to both an internal cache and the file system */
	public readonly storage = new DualStorage()

	/** @param settings Client settings object */
	public constructor(settings: ClientSettings) {
		this.env.set("token", settings.token)
		this.env.set("cmd_guilds", settings.dev_guilds ?? [])
		this.env.set("cmd_global", settings.global_update ?? false)
		this.env.set("log_color", settings.color ?? "#5865F2")
		this.env.set("log_header", settings.header ?? "Wyvern Client")
		this.env.set("log_enable", !(settings.silent ?? false))
		this.env.set("log_store", settings.save_logs ?? false)
		this.env.set("timer_delay", settings.timer_interval ?? 30_000)

		this.logger = new Logger()
		this.logger.colors.create("main", this.color)
		this.logger.colors.create("other", "gray-bright")
		this.logger.colors.create("info", "blue-bright")
		this.logger.colors.create("warn", "yellow-bright")
		this.logger.colors.create("error", "red-bright")
		this.logger.props.create(Level.All, () => `[${this.header}]`, new Rule(/.+/, "main"))
		this.logger.props.create(Level.All, () => `${dayjs().format("DD-MM-YY HH:mm:ss:SSS")}`, new Rule(/.+/, "other"))
		this.logger.props.create(Level.Info, () => "->", new Rule(/->/, "info"))
		this.logger.props.create(Level.Warn, () => "->", new Rule(/->/, "warn"))
		this.logger.props.create(Level.Error, () => "->", new Rule(/->/, "error"))
		this.logger.enabled = this.logs_enabled
		this.logger.store = this.logs_stored

		this.client = new Client({ intents: settings.intents, partials: settings.partials ?? [] })

		this.timer = new Timer(this)
		this.__buttons = new ButtonActionManager(this)
		this.__commands = new CommandActionManager(this)
		this.__modals = new ModalActionManager(this)
		this.__select_menus = new SelectMenuActionManager(this)
	}

	/** The client's API token */
	public get token() {
		return this.env.get<string>("token")!
	}
	/** A list of development guild identifiers */
	public get development_guilds() {
		return this.env.get<string[]>("cmd_guilds")!
	}
	/** Whether global commands are updated on connect */
	public get global_update() {
		return this.env.get<boolean>("cmd_global")!
	}
	/** The client's log header */
	public get header() {
		return this.env.get<string>("log_header")!
	}
	/** The client's log color */
	public get color() {
		return this.env.get<`#${string}`>("log_color")!
	}
	/** Whether logs are enabled */
	public get logs_enabled() {
		return this.env.get<boolean>("log_enable")!
	}
	/** Whether loges are stored */
	public get logs_stored() {
		return this.env.get<boolean>("log_store")!
	}
	/** Number of milliseconds between each timer tick */
	public get timer_delay() {
		return this.env.get<number>("timer_delay")!
	}
	/** Handles interaction callbacks */
	public get action() {
		return {
			/** Button action manager */
			buttons: this.__buttons,
			/** Command action manager */
			commands: this.__commands,
			/** Modal action manager */
			modals: this.__modals,
			/** Select menu action manager */
			select_menus: this.__select_menus,
		}
	}

	/** Connect to the Discord API */
	public async connect() {
		this.client.once("ready", async () => {
			this.logger.info(`Connected to the API as ${this.client.user!.tag}`)
			await this.action.commands.register()
			this.timer.start()
			await this.timer.tick()
		})

		await this.client.login(this.token)
	}
}
