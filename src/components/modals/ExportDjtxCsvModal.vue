<template>
    <modal ref="modal" title="Export DJTX Transfers" class="modal_main">
        <div class="csv_modal_body">
            <p>Only X chain DJTX transactions will be exported.</p>
            <v-btn
                class="button_secondary"
                small
                @click="submit"
                :disabled="!canSubmit"
                depressed
                block
                style="margin-top: 12px"
            >
                Download CSV File
            </v-btn>
        </div>
    </modal>
</template>
<script lang="ts">
import 'reflect-metadata'
import { Vue, Component, Prop } from 'vue-property-decorator'

import Modal from '@/components/modals/Modal.vue'
import { CsvRowDjtxTransferData, ITransactionData, UTXO } from '@/store/modules/history/types'
import { bnToBig } from '@/helpers/helper'
import { getPriceAtUnixTime } from '@/helpers/price_helper'
const generate = require('csv-generate')
import moment from 'moment'
import {
    djtxTransferDataToCsvRow,
    durationToString,
    getOutputTotals,
    getOwnedOutputs,
    getNotOwnedOutputs,
    getAssetOutputs,
    getAddresses,
    getRewardOuts,
    getStakeAmount,
    createCSVContent,
    downloadCSVFile,
    parseMemo,
} from '@/store/modules/history/history_utils'
import { ava, avm } from '@/AVA'
import BN from 'bn.js'

@Component({
    components: {
        Modal,
    },
})
export default class ExportDjtxCsvModal extends Vue {
    open(): void {
        let modal = this.$refs.modal as Modal
        modal.open()
    }

    get canSubmit() {
        return true
    }

    get transactions(): ITransactionData[] {
        return this.$store.state.History.allTransactions
    }

    get wallet() {
        return this.$store.state.activeWallet
    }

    get xAddresses(): string[] {
        return this.wallet.getAllAddressesX()
    }

    get xAddressesStripped(): string[] {
        return this.xAddresses.map((addr: string) => addr.split('-')[1])
    }

    get djtxID() {
        return this.$store.state.Assets.AVA_ASSET_ID
    }

    submit() {
        let myAddresses = this.xAddressesStripped
        let djtxID = this.djtxID

        let txs = this.transactions.filter((tx) => {
            let djtxOutAmt = tx.outputTotals[djtxID]

            if (!djtxOutAmt) return false

            return tx.type === 'base' || tx.type === 'operation'
        })

        let txFee = avm.getTxFee()

        let rows: CsvRowDjtxTransferData[] = []
        const ZERO = new BN(0)

        for (let i = 0; i < txs.length; i++) {
            let tx = txs[i]

            let ins = tx.inputs || []
            let inUTXOs = ins.map((input) => input.output)

            let djtxIns = getAssetOutputs(inUTXOs, djtxID)
            let djtxOuts = getAssetOutputs(tx.outputs, djtxID)

            let myIns = getOwnedOutputs(djtxIns, myAddresses)
            let myOuts = getOwnedOutputs(djtxOuts, myAddresses)

            let inTot = getOutputTotals(myIns)
            let outTot = getOutputTotals(myOuts)

            let gain = outTot.sub(inTot)

            let otherIns = getNotOwnedOutputs(djtxIns, myAddresses)
            let otherOuts = getNotOwnedOutputs(djtxOuts, myAddresses)

            // If its only the fee, continue
            if (gain.abs().lte(txFee)) continue

            let isGain = gain.gt(ZERO)

            let fromOwnedAddrs = getAddresses(myIns)
            let toOwnedAddrs = getAddresses(myOuts)

            let fromAddrs = getAddresses(otherIns)
            let toAddrs = getAddresses(otherOuts)

            // Subtract the fee if we sent it
            let sendAmt = isGain ? gain : gain.add(txFee)

            let txParsed: CsvRowDjtxTransferData = {
                txId: tx.id,
                date: new Date(tx.timestamp),
                amount: bnToBig(sendAmt, 9),
                from: isGain ? fromAddrs : fromOwnedAddrs,
                to: isGain ? toOwnedAddrs : toAddrs,
                memo: parseMemo(tx.memo),
                isGain: isGain,
            }
            rows.push(txParsed)
        }

        let csvRows = rows.map((row) => djtxTransferDataToCsvRow(row))
        let headers = ['Tx ID', 'Date', 'Memo', 'From', 'To', 'Sent/Received', 'Amount (DJTX)']
        let allRows = [headers, ...csvRows]

        let csvContent = createCSVContent(allRows)
        downloadCSVFile(csvContent, 'djtx_transfers')
    }
}
</script>
<style scoped lang="scss">
.csv_modal_body {
    width: 420px;
    max-width: 100%;
    padding: 10px 20px;
}
</style>
