import { ethers } from "hardhat";
import { expect } from "chai";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

import {
  Token,
  Token__factory
} from "../typechain-types";
import { BigNumber } from "@ethersproject/bignumber";
import { evmBlockTimestamp, evmSnapshot } from "../utils/evmUtilities";

import increaseTime = evmBlockTimestamp.increaseTime;
import { getSecondsFromDays } from "../utils/mathUtilities";


const fmt = (amount: BigNumber) => {
  return ethers.utils.formatUnits(amount);
};

describe("Token", () => {
  let provider: any;
  let accounts: SignerWithAddress[];

  let simple: Token;
    const timeToVote = getSecondsFromDays(2);
    const initialSupply = ethers.utils.parseUnits('10000', 18);
    const startPrice = ethers.utils.parseUnits('0.01', 18);

  before(async () => {

    provider = ethers.provider;
    accounts = await ethers.getSigners();

    simple = await new Token__factory(accounts[0]).deploy(
      timeToVote,
      startPrice,
      initialSupply,
      'TokenExperemental',
      'Token',
    );
  });

  it('Buy token', async () => {
    console.log('Balance before buying: ', await simple.balanceOf(accounts[0].address))
    await (await simple.buy({value: ethers.utils.parseUnits('1')})).wait()
    const afterBuyBalance = await simple.balanceOf(accounts[0].address)
    console.log('Balance after buying: ', afterBuyBalance)
    expect(afterBuyBalance.eq(afterBuyBalance.mul(ethers.utils.parseUnits('1')).div(startPrice)))
  })

  it('Sell tokens', async () => {
    console.log('Balance before selling: ', await simple.balanceOf(accounts[1].address))
    await simple.connect(accounts[1]).buy({value: ethers.utils.parseUnits('1')})
    const afterBuyBalance = await simple.balanceOf(accounts[1].address)
    console.log('Balance after selling: ', afterBuyBalance)
    expect(afterBuyBalance.eq(afterBuyBalance.mul(ethers.utils.parseUnits('1')).div(startPrice)))
    const amountForSell = ethers.utils.parseUnits('50')
    await simple.connect(accounts[1]).sell(amountForSell)
    const balanceAfterSell = await simple.balanceOf(accounts[1].address)
    console.log("Balance after sell:", balanceAfterSell);
    expect(balanceAfterSell.eq(afterBuyBalance.div(amountForSell)))
  })

  it("Start voting", async () => {
    await simple.connect(accounts[2]).buy({value: ethers.utils.parseUnits('5')})
    const balance = await simple.balanceOf(accounts[2].address)
    console.log('Balance percent: ',(await simple.calculateBalancePercents(balance)).div(100).toNumber());
    const newPrice = ethers.utils.parseUnits('0.5')
    console.log("Starting voting with price: 0.5 ETH");
    await simple.connect(accounts[2]).startVoting(newPrice);

    const currentVoting = await simple.currentVoting()
    console.log('voting number: %d \n voting newPrice: %d', currentVoting.votingNumber, currentVoting.newPrice);
    expect(currentVoting.votingNumber.eq(1));
    expect(currentVoting.newPrice.eq(newPrice));
  })

  it("Vote to price change", async () => {
    await simple.connect(accounts[3]).buy({value: ethers.utils.parseUnits('5')})
    await simple.connect(accounts[4]).buy({value: ethers.utils.parseUnits('5')})
    await simple.connect(accounts[5]).buy({value: ethers.utils.parseUnits('5')})

    let currentVoting = await simple.currentVoting()
    console.log('Votes count before votes: agree = %d, disagree = %d', +currentVoting.votedAgree, +currentVoting.votedDesagree);
    
    await simple.connect(accounts[3]).votePriceChange(true)
    currentVoting = await simple.currentVoting()
    console.log('Votes count after vote: agree = %d, disagree = %d', +currentVoting.votedAgree, +currentVoting.votedDesagree);
    await simple.connect(accounts[4]).votePriceChange(true)
    currentVoting = await simple.currentVoting()
    console.log('Votes count after vote: agree = %d, disagree = %d', +currentVoting.votedAgree, +currentVoting.votedDesagree);
    await simple.connect(accounts[5]).votePriceChange(true)
    currentVoting = await simple.currentVoting()
    console.log('Votes count after vote: agree = %d, disagree = %d', +currentVoting.votedAgree, +currentVoting.votedDesagree);
  })

  it("Vote second time in one voting", async () => {
    await expect(simple.connect(accounts[3]).votePriceChange(false)).revertedWith("User already voted!") ;
  })

  it("End voting who didn't end", async () => {
    await expect(simple.connect(accounts[9]).changePriceAndClearVoting()).revertedWith('!end')
  });

  it("End voting", async () => {
    await increaseTime(timeToVote);
    let startTimestamp = await simple.startVotingTimestamp();
    expect(startTimestamp.gt(0))
    await simple.connect(accounts[9]).changePriceAndClearVoting()
    startTimestamp = await simple.startVotingTimestamp();
    expect(startTimestamp.eq(0))
  });

  it("Try to tart voting from a whale", async () => {
    const newPrice = ethers.utils.parseUnits('1')
    await expect(simple.connect(accounts[8]).startVoting(newPrice)).revertedWith('balance percent < 5%')
  })
});
