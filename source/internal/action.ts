import {
	ApplicationCommandData,
	BaseInteraction,
	ButtonInteraction,
	CommandInteraction,
	EmbedBuilder,
	ModalSubmitInteraction,
	SelectMenuInteraction,
	PermissionResolvable,
} from "discord.js"
import { autoCatch, WyvernClient } from ".."

/** Action invocation callback function */
export type ActionCallback<I extends BaseInteraction> = (context: ActionContext<I>) => Promise<void>

/** Provides utility methods for interactions */
export class ActionContext<I extends BaseInteraction> {
	/** Bot client wrapper */
	public readonly bot: WyvernClient
	/** Interaction instance */
	public readonly interaction: I
	/** A list of data stored within a `custom_id` */
	public readonly custom_data: string[]

	/**
	 * @param bot Bot client wrapper
	 * @param interaction Interaction instance
	 * @param custom_data A list of data stored within a `custom_id`
	 */
	public constructor(bot: WyvernClient, interaction: I, custom_data: string[]) {
		this.bot = bot
		this.interaction = interaction
		this.custom_data = custom_data
	}

	/** Interaction guild instance */
	public guild() {
		if (!this.interaction.guild) throw "Expected guild!"
		return this.interaction.guild
	}
	/** Interaction channel instance */
	public channel() {
		if (!this.interaction.channel) throw "Expected guild!"
		return this.interaction.channel
	}
	/** Interaction api member instance */
	public api_member() {
		if (!this.interaction.member) throw "Expected member!"
		return this.interaction.member
	}
	/** Interaction member instance */
	public async member() {
		if (!this.interaction.member) throw "Expected member!"
		return this.guild().members.fetch(this.interaction.member.user.id)
	}
	/** Throws an error if the interaction's member instance does not represent the bot owner */
	public expect_owner() {
		if (this.api_member().user.id !== process.env["OWNER"]) throw "Invalid permissions!"
	}
	/** Throws an error if the interaction's member instance does not hold the provided permissions */
	public require_permissions(...permissions: PermissionResolvable[]) {
		if (!this.interaction.memberPermissions) throw "Invalid permissions!"

		for (const permission of permissions) {
			if (!this.interaction.memberPermissions.has(permission)) throw "Invalid permissions!"
		}
	}
}

/** Manages callback invocation for interactions */
export abstract class BaseActionManager<I extends BaseInteraction> {
	/** Bot client wrapper */
	protected readonly _bot: WyvernClient
	/** Map of action callbacks stored by identifier */
	protected readonly _callbacks = new Map<string, ActionCallback<I>>()

	/** @param bot Bot client wrapper */
	public constructor(bot: WyvernClient) {
		this._bot = bot
		this._on_construct()
	}

	/** Callback function that is run on instance creation */
	protected abstract _on_construct(): void

	/** Creates an action callback function */
	public async on(id: string, callback: ActionCallback<I>) {
		if (id.includes(";")) id = id.split(";")[0]!
		this._callbacks.set(id, callback)
		return this
	}
	/** Invokes an action callback function */
	public async invoke(id: string, interaction: I) {
		const raw_id = id.includes(";") ? id.split(";")[0]! : id
		const custom_data = id.split(";").slice(1)
		const context = new ActionContext<I>(this._bot, interaction, custom_data)
		const type = interaction.constructor.name

		if (this._callbacks.has(raw_id)) {
			const callback = this._callbacks.get(raw_id)!
			const result = await autoCatch(callback(context))

			if (result.success) {
				this._bot.logger.info(`Invoked action callback for ${type} ${raw_id}`)
			} else {
				try {
					if (!interaction.isRepliable()) throw "Interaction is not replyable!"

					const embed = new EmbedBuilder()
						.setColor("Red")
						.setTitle(`Error invoking action callback for "${raw_id}"`)
						.setDescription(`> ${result.reason}`)

					if (interaction.deferred) {
						await interaction.followUp({ embeds: [embed] })
					} else {
						await interaction.reply({ embeds: [embed], ephemeral: true })
					}
				} catch (error) {
					this._bot.logger.error(
						`Error sending error embed for ${type} ${raw_id}\n\t-> ${result.reason}\n\t-> ${error}`
					)
				}
			}
		} else {
			this._bot.logger.error(`Missing action callback for ${type} ${raw_id}`)
		}
	}
}

/** Manages callback invocation for interactions with associated structure definitions */
export abstract class DefinedActionManager<I extends BaseInteraction, D> extends BaseActionManager<I> {
	/** Map of structure definitions stored by identifier */
	protected _definitions = new Map<string, D>()

	/**
	 * Defines an action's associated data structure
	 * @param id Definition identifier
	 * @param data Action data structure
	 */
	public define(id: string, data: D) {
		if (id.includes(";")) id = id.split(";")[0]!
		this._definitions.set(id, data)
		return this
	}

	public override on(id: string, callback: ActionCallback<I>): Promise<this> {
		if (id.includes(";")) id = id.split(";")[0]!
		if (!this._definitions.has(id)) throw `Missing associated definition for ${id}`
		return super.on(id, callback)
	}
}

/** Manages callback invocation for button interactions */
export class ButtonActionManager extends BaseActionManager<ButtonInteraction> {
	protected _on_construct() {
		this._bot.client.on("interactionCreate", (interaction) => {
			if (!interaction.isButton()) return
			this.invoke(interaction.customId, interaction)
		})
	}
}

/** Manages callback invocation for command interactions */
export class CommandActionManager extends DefinedActionManager<CommandInteraction, ApplicationCommandData> {
	protected _on_construct() {
		this._bot.client.on("interactionCreate", (interaction) => {
			if (!interaction.isCommand()) return
			this.invoke(interaction.commandName, interaction)
		})
	}

	/** Registers application commands */
	public async register() {
		const commands = [...this._definitions.values()]

		try {
			for (const guild_id of this._bot.development_guilds) {
				const guild = await this._bot.client.guilds.fetch(guild_id)
				await guild.commands.set(commands)
				this._bot.logger.info(`Updated ${commands.length} commands in guild ${guild.name} (${guild_id})`)
			}

			if (this._bot.global_update) {
				if (!this._bot.client.application) throw "Missing application object"
				await this._bot.client.application.commands.set(commands)
				this._bot.logger.info(`Updated ${commands.length} commands globally`)
			}
		} catch (error) {
			this._bot.logger.error(`Error while refreshing application commands\n\t-> ${error}`)
		}
	}
}

/** Manages callback invocation for modal interactions */
export class ModalActionManager extends BaseActionManager<ModalSubmitInteraction> {
	protected _on_construct() {
		this._bot.client.on("interactionCreate", (interaction) => {
			if (!interaction.isModalSubmit()) return
			this.invoke(interaction.customId, interaction)
		})
	}
}

/** Manages callback invocation for modal interactions */
export class SelectMenuActionManager extends BaseActionManager<SelectMenuInteraction> {
	protected _on_construct() {
		this._bot.client.on("interactionCreate", (interaction) => {
			if (!interaction.isSelectMenu()) return
			this.invoke(interaction.customId, interaction)
		})
	}
}
